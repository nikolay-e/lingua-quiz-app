"""Move transliterations from A1/A2 to A0."""

import json
from pathlib import Path

from ..analysis.transliteration_detector import TransliterationDetector


def is_transliteration(source, target, lang_code="en"):
    """Check if target is transliteration of source."""
    detector = TransliterationDetector(similarity_threshold=0.65)

    # Handle multiple translations (split by | or ,)
    target_variants = []
    if "|" in target:
        target_variants = [v.strip() for v in target.split("|")]
    elif "," in target:
        target_variants = [v.strip() for v in target.split(",")]
    else:
        target_variants = [target.strip()]

    # Check each variant
    for variant in target_variants:
        is_trans, similarity = detector.is_transliteration(source, variant, source_lang=lang_code, target_lang="ru")
        if is_trans:
            return True

    return False


def move_transliterations(lang_name, from_level="a1"):
    """Move transliterations from A1/A2 to A0."""
    # Map language name to code
    lang_map = {"english": "en", "spanish": "es", "german": "de"}
    lang_code = lang_map.get(lang_name, "en")

    backend_path = Path(__file__).parent.parent.parent.parent / "backend"
    vocab_dir = backend_path / "migrations" / "data" / "vocabulary"

    # Load source file
    source_file = vocab_dir / f"{lang_name}-russian-{from_level}.json"
    if not source_file.exists():
        print(f"⚠️  {source_file.name} not found")
        return

    with open(source_file, encoding="utf-8") as f:
        source_data = json.load(f)

    source_entries = source_data["word_pairs"]

    # Find transliterations
    transliterations = []
    remaining_entries = []

    for entry in source_entries:
        if is_transliteration(entry["source_word"], entry["target_word"], lang_code):
            transliterations.append(entry)
        else:
            remaining_entries.append(entry)

    if not transliterations:
        print(f"✓  {lang_name.upper()}-{from_level.upper()}: No transliterations found")
        return

    print(f"\n{lang_name.upper()}-{from_level.upper()}: Found {len(transliterations)} transliterations:")
    for t in transliterations[:10]:
        print(f"  {t['source_word']:<20} → {t['target_word']}")
    if len(transliterations) > 10:
        print(f"  ... and {len(transliterations) - 10} more")

    # Load or create A0 file
    a0_file = vocab_dir / f"{lang_name}-russian-a0.json"

    if a0_file.exists():
        with open(a0_file, encoding="utf-8") as f:
            a0_data = json.load(f)
        a0_entries = a0_data["word_pairs"]
    else:
        a0_data = {
            "source_language": source_data.get("source_language", lang_name.capitalize()),
            "target_language": "Russian",
            "word_list_name": f"{lang_name.capitalize()} Russian A0",
            "word_pairs": [],
        }
        a0_entries = []

    # Add transliterations to A0
    a0_entries.extend(transliterations)
    a0_data["word_pairs"] = a0_entries

    # Update source file
    source_data["word_pairs"] = remaining_entries

    # Save files
    with open(a0_file, "w", encoding="utf-8") as f:
        json.dump(a0_data, f, ensure_ascii=False, indent=2)

    with open(source_file, "w", encoding="utf-8") as f:
        json.dump(source_data, f, ensure_ascii=False, indent=2)

    print(f"✅ Moved {len(transliterations)} words to {lang_name.upper()}-A0")
    print(f"   {source_file.name}: {len(source_entries)} → {len(remaining_entries)} words")
    print(f"   {a0_file.name}: {len(a0_entries) - len(transliterations)} → {len(a0_entries)} words")


if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage: python move_transliterations.py <language> [level]")
        print("Example: python move_transliterations.py english a1")
        print("Example: python move_transliterations.py spanish a2")
        sys.exit(1)

    lang = sys.argv[1]
    level = sys.argv[2] if len(sys.argv) > 2 else "a1"

    move_transliterations(lang, level)
