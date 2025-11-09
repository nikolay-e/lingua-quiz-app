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

    entries = original_data.get("word_pairs", original_data if isinstance(original_data, list) else [])
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

    # Load analysis
    analysis = load_analysis(lang_code, level, output_dir)
    if not analysis:
        raise FileNotFoundError(
            f"Analysis file not found. Run: vocab-tools analyze {lang_code}-{level} --format json --output {output_dir}"
        )

    # Load migration
    entries, original_data, migration_file = load_migration(lang_code, level)

    # Find existing words
    existing_lemmas = {entry["source_word"].lower() for entry in entries}

    # Get missing words within rank range
    missing_words = []
    for item in analysis:
        if item["status"] == "MISSING":
            lemma = item["lemma"]
            rank = item.get("rank", 999999)
            priority = item.get("priority", 999)

            # Skip if already exists
            if lemma.lower() in existing_lemmas:
                continue

            # Filter by rank range for this level
            if rank < min_rank or rank > max_rank:
                continue

            missing_words.append(
                {"lemma": lemma, "rank": rank, "priority": priority, "forms": item.get("forms", [lemma])}
            )

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
    if isinstance(original_data, dict) and "word_pairs" in original_data:
        original_data["word_pairs"] = all_entries
        data_to_write = original_data
    else:
        data_to_write = all_entries

    with open(migration_file, "w", encoding="utf-8") as f:
        json.dump(data_to_write, f, ensure_ascii=False, indent=2)

    stats["file_path"] = str(migration_file)

    return stats
