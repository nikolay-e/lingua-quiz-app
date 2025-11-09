"""
Fill missing high-frequency words in migrations.

Adds words from frequency lists that are missing from migration files.
"""

import json
from pathlib import Path


def load_migration(lang_code: str, level: str) -> tuple[list, dict, Path]:
    """Load migration JSON file."""
    lang_map = {"en": "english", "es": "spanish", "de": "german", "ru": "russian"}
    lang_name = lang_map.get(lang_code, lang_code)

    backend_path = Path(__file__).parent.parent.parent.parent / "backend"
    migration_dir = backend_path / "migrations" / "data" / "vocabulary"
    migration_file = migration_dir / f"{lang_name}-russian-{level}.json"

    if not migration_file.exists():
        raise FileNotFoundError(f"Migration file not found: {migration_file}")

    with open(migration_file, encoding="utf-8") as f:
        original_data = json.load(f)

    entries = original_data.get("translations", original_data if isinstance(original_data, list) else [])
    return entries, original_data, migration_file


def load_analysis(lang_code: str, level: str, output_dir: Path) -> list | None:
    """Load analysis JSON for language/level."""
    analysis_file = output_dir / f"{lang_code}_vocabulary_detailed.json"

    if analysis_file.exists():
        with open(analysis_file, encoding="utf-8") as f:
            return json.load(f)

    return None


def get_rank_range(level: str) -> tuple[int, int]:
    """Get expected rank range for CEFR level."""
    rank_ranges = {"a1": (1, 1000), "a2": (1001, 2000), "b1": (2001, 4000), "b2": (4001, 6000), "c1": (6001, 12000)}
    return rank_ranges.get(level.lower(), (1, 1000))


def _load_previous_levels(lang_code: str, level: str) -> dict[str, list[str]]:
    """Load vocabulary from all previous levels."""
    level_hierarchy = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"]
    current_idx = level_hierarchy.index(level.lower()) if level.lower() in level_hierarchy else -1

    if current_idx <= 0:
        return {}

    previous_levels = level_hierarchy[:current_idx]
    result = {}

    for prev_level in previous_levels:
        try:
            entries, _, _ = load_migration(lang_code, prev_level)
            result[prev_level] = [entry["source_word"] for entry in entries]
        except FileNotFoundError:
            # Level doesn't exist, skip
            continue

    return result


def fill_missing_words(
    lang_code: str, level: str, target_count: int = 1000, output_dir: Path | None = None, dry_run: bool = False
) -> dict:
    """
    Fill missing high-frequency words in migration.

    Args:
        lang_code: Language code (en, es, de, ru)
        level: CEFR level (a1, a2, b1, b2)
        target_count: Target number of words
        output_dir: Directory containing analysis JSON
        dry_run: If True, don't save changes

    Returns:
        Dictionary with statistics about the operation
    """
    if output_dir is None:
        output_dir = Path("/tmp")

    min_rank, max_rank = get_rank_range(level)

    # Load frequency list directly
    from ..core.frequency_list_loader import find_frequency_list, load_frequency_list

    freq_list_path = find_frequency_list(lang_code)
    if not freq_list_path:
        raise FileNotFoundError(f"Frequency list not found for language: {lang_code}")

    freq_list = load_frequency_list(freq_list_path)

    # Load migration
    entries, original_data, migration_file = load_migration(lang_code, level)

    # Find existing words in THIS level
    existing_lemmas = {entry["source_word"].lower() for entry in entries}

    # Load previous levels to exclude them
    previous_levels = _load_previous_levels(lang_code, level)
    previous_lemmas = {word.lower() for words in previous_levels.values() for word in words}

    # Get missing words within rank range (excluding previous levels)
    missing_words = []
    for rank, word_obj in enumerate(freq_list.words, start=1):
        lemma = word_obj.lemma

        # Filter by rank range for this level
        if rank < min_rank or rank > max_rank:
            continue

        # Skip if already exists in this level
        if lemma.lower() in existing_lemmas:
            continue

        # Skip if exists in previous levels
        if lemma.lower() in previous_lemmas:
            continue

        # Determine priority based on rank
        if rank <= 100:
            priority = 0  # Critical
        elif rank <= 500:
            priority = 1  # High
        elif rank <= 1000:
            priority = 2  # Medium
        else:
            priority = 3  # Low

        missing_words.append({"lemma": lemma, "rank": rank, "priority": priority, "forms": [word_obj.word]})

    # Sort by priority and rank
    missing_words_sorted = sorted(missing_words, key=lambda x: (x["priority"], x["rank"]))

    # Calculate how many to add
    to_add_count = min(target_count - len(entries), len(missing_words_sorted))

    stats = {
        "current_count": len(entries),
        "target_count": target_count,
        "missing_available": len(missing_words_sorted),
        "missing_critical": len([w for w in missing_words_sorted if w["priority"] == 1]),
        "missing_high": len([w for w in missing_words_sorted if w["priority"] == 2]),
        "missing_medium": len([w for w in missing_words_sorted if w["priority"] == 3]),
        "to_add_count": to_add_count,
        "new_total": len(entries) + to_add_count,
        "words_added": [],
    }

    if to_add_count <= 0:
        return stats

    if dry_run:
        stats["words_added"] = [w["lemma"] for w in missing_words_sorted[:to_add_count]]
        return stats

    # Create new entries
    new_entries = []
    for word_info in missing_words_sorted[:to_add_count]:
        lemma = word_info["lemma"]

        new_entry = {
            "source_word": lemma,
            "target_word": f"[translation needed for: {lemma}]",
            "cefr_level": level.upper(),
            "source_example": "",
            "target_example": "",
        }

        new_entries.append(new_entry)
        stats["words_added"].append(lemma)

    # Combine entries
    all_entries = entries + new_entries

    # Save
    if isinstance(original_data, dict) and "translations" in original_data:
        original_data["translations"] = all_entries
        data_to_write = original_data
    else:
        data_to_write = all_entries

    with open(migration_file, "w", encoding="utf-8") as f:
        json.dump(data_to_write, f, ensure_ascii=False, indent=2)

    stats["file_path"] = str(migration_file)

    return stats
