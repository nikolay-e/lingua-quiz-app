import json
from pathlib import Path
from typing import Any


def format_vocabulary_json(input_path: Path, output_path: Path | None = None, dry_run: bool = False) -> dict[str, Any]:
    if output_path is None:
        output_path = input_path

    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    word_pairs = data.get("word_pairs", [])

    stats = {
        "original_count": len(word_pairs),
        "final_count": len(word_pairs),
    }

    if not dry_run:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return stats


def format_all_vocabulary_files(
    vocabulary_dir: Path, dry_run: bool = False, file_pattern: str = "*-russian-*.json"
) -> dict[str, dict[str, Any]]:
    results = {}

    for json_file in sorted(vocabulary_dir.glob(file_pattern)):
        print(f"Processing {json_file.name}...")
        try:
            stats = format_vocabulary_json(json_file, dry_run=dry_run)
            results[json_file.name] = stats
            print(f"  Total: {stats['final_count']} word pairs")
        except Exception as e:
            print(f"  ERROR: {e}")
            results[json_file.name] = {"error": str(e)}

    return results
