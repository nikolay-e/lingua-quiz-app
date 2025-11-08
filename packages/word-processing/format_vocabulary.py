#!/usr/bin/env python3
"""
Format vocabulary JSON files:
- Sort by translation_id
- Add placeholders for missing sequence_numbers (starting from 0)
- Generate correct IDs using level_base_offset
"""

import argparse
from pathlib import Path

from vocab_tools.formatters.json_formatter import format_all_vocabulary_files, format_vocabulary_json


def main():
    parser = argparse.ArgumentParser(description="Format vocabulary JSON files with placeholders")
    parser.add_argument(
        "--file",
        type=Path,
        help="Single JSON file to format (default: process all files in vocabulary directory)",
    )
    parser.add_argument(
        "--vocabulary-dir",
        type=Path,
        default=Path(__file__).parent.parent / "backend" / "migrations" / "data" / "vocabulary",
        help="Directory containing vocabulary JSON files",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show statistics without modifying files",
    )
    parser.add_argument(
        "--pattern",
        type=str,
        default="*-russian-*.json",
        help="File pattern to match (default: *-russian-*.json)",
    )

    args = parser.parse_args()

    if args.file:
        print(f"Formatting single file: {args.file}")
        try:
            stats = format_vocabulary_json(args.file, dry_run=args.dry_run)
            print("\nResults:")
            print(f"  Original entries: {stats['original_count']}")
            print(f"  Placeholders added: {stats['placeholders_added']}")
            print(f"  Source IDs corrected: {stats['source_ids_corrected']}")
            print(f"  Target IDs corrected: {stats['target_ids_corrected']}")
            print(f"  Final entries: {stats['final_count']}")
            if args.dry_run:
                print("\n[DRY RUN] No changes written")
        except Exception as e:
            print(f"ERROR: {e}")
            return 1
    else:
        print(f"Formatting all files in: {args.vocabulary_dir}")
        print(f"Pattern: {args.pattern}")
        if args.dry_run:
            print("[DRY RUN MODE]\n")

        results = format_all_vocabulary_files(
            args.vocabulary_dir,
            dry_run=args.dry_run,
            file_pattern=args.pattern,
        )

        print(f"\n{'=' * 60}")
        print("SUMMARY")
        print(f"{'=' * 60}")

        total_files = len(results)
        total_placeholders = sum(r.get("placeholders_added", 0) for r in results.values() if "error" not in r)
        total_source_corrected = sum(r.get("source_ids_corrected", 0) for r in results.values() if "error" not in r)
        total_target_corrected = sum(r.get("target_ids_corrected", 0) for r in results.values() if "error" not in r)
        errors = sum(1 for r in results.values() if "error" in r)

        print(f"Files processed: {total_files}")
        print(f"Total placeholders added: {total_placeholders}")
        print(f"Total source IDs corrected: {total_source_corrected}")
        print(f"Total target IDs corrected: {total_target_corrected}")
        print(f"Errors: {errors}")

        if args.dry_run:
            print("\n[DRY RUN] No changes written")

    return 0


if __name__ == "__main__":
    import sys

    sys.exit(main())
