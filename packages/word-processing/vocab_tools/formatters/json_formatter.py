import json
from pathlib import Path
from typing import Any


def calculate_ids(level_base_offset: int, sequence_number: int) -> dict[str, int]:
    return {
        "translation_id": level_base_offset + sequence_number,
        "source_id": level_base_offset + (sequence_number * 2) + 1,
        "target_id": level_base_offset + (sequence_number * 2) + 2,
    }


def create_placeholder(level_base_offset: int, sequence_number: int) -> dict[str, Any]:
    ids = calculate_ids(level_base_offset, sequence_number)
    return {
        "translation_id": ids["translation_id"],
        "source_id": ids["source_id"],
        "target_id": ids["target_id"],
        "source_word": "[PLACEHOLDER]",
        "target_word": "[PLACEHOLDER]",
        "source_example": "",
        "target_example": "",
    }


def validate_and_fix_ids(pair: dict[str, Any], level_base_offset: int) -> dict[str, Any]:
    translation_id = pair.get("translation_id")
    if translation_id is None:
        return {"source_corrected": False, "target_corrected": False}

    sequence_number = translation_id - level_base_offset
    correct_ids = calculate_ids(level_base_offset, sequence_number)

    source_corrected = False
    target_corrected = False

    if pair.get("source_id") != correct_ids["source_id"]:
        pair["source_id"] = correct_ids["source_id"]
        source_corrected = True

    if pair.get("target_id") != correct_ids["target_id"]:
        pair["target_id"] = correct_ids["target_id"]
        target_corrected = True

    return {"source_corrected": source_corrected, "target_corrected": target_corrected}


def format_vocabulary_json(input_path: Path, output_path: Path | None = None, dry_run: bool = False) -> dict[str, Any]:
    if output_path is None:
        output_path = input_path

    with open(input_path, encoding="utf-8") as f:
        data = json.load(f)

    level_base_offset = data.get("level_base_offset")
    if level_base_offset is None:
        raise ValueError(f"Missing 'level_base_offset' in {input_path}")

    word_pairs = data.get("word_pairs", [])

    existing_sequence_numbers = set()
    for pair in word_pairs:
        translation_id = pair.get("translation_id")
        if translation_id is None:
            continue
        sequence_number = translation_id - level_base_offset
        existing_sequence_numbers.add(sequence_number)

    max_sequence = -1 if not existing_sequence_numbers else max(existing_sequence_numbers)

    all_pairs = []
    stats = {
        "original_count": len(word_pairs),
        "placeholders_added": 0,
        "source_ids_corrected": 0,
        "target_ids_corrected": 0,
        "final_count": 0,
    }

    for seq_num in range(max_sequence + 1):
        if seq_num in existing_sequence_numbers:
            matching_pair = next(pair for pair in word_pairs if pair.get("translation_id") == level_base_offset + seq_num)
            corrections = validate_and_fix_ids(matching_pair, level_base_offset)
            if corrections["source_corrected"]:
                stats["source_ids_corrected"] += 1
            if corrections["target_corrected"]:
                stats["target_ids_corrected"] += 1
            all_pairs.append(matching_pair)
        else:
            placeholder = create_placeholder(level_base_offset, seq_num)
            all_pairs.append(placeholder)
            stats["placeholders_added"] += 1

    all_pairs.sort(key=lambda x: x["translation_id"])

    stats["final_count"] = len(all_pairs)

    data["word_pairs"] = all_pairs

    if not dry_run:
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    return stats


def format_all_vocabulary_files(vocabulary_dir: Path, dry_run: bool = False, file_pattern: str = "*-russian-*.json") -> dict[str, dict[str, Any]]:
    results = {}

    for json_file in sorted(vocabulary_dir.glob(file_pattern)):
        print(f"Processing {json_file.name}...")
        try:
            stats = format_vocabulary_json(json_file, dry_run=dry_run)
            results[json_file.name] = stats
            print(
                f"  Original: {stats['original_count']} | Placeholders: {stats['placeholders_added']} | "
                f"Source IDs fixed: {stats['source_ids_corrected']} | Target IDs fixed: {stats['target_ids_corrected']} | "
                f"Final: {stats['final_count']}"
            )
        except Exception as e:
            print(f"  ERROR: {e}")
            results[json_file.name] = {"error": str(e)}

    return results
