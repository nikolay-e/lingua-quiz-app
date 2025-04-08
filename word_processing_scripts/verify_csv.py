import csv
import os
from pathlib import Path
from collections import defaultdict
import sys

try:
    script_dir = Path(__file__).resolve().parent
    MIGRATIONS_DIR = (script_dir / '../packages/backend/migrations').resolve()
    print(f"Calculated Migrations Directory: {MIGRATIONS_DIR}") # Debugging line
except NameError:
     print("[WARNING] __file__ not defined. Falling back to path relative to current working directory.")
     MIGRATIONS_DIR = Path("./packages/backend/migrations").resolve()

SOURCE_WORD_COL_INDEX = 3 # Index of the source_word column (0-based)
TARGET_WORD_COL_INDEX = 4 # Index of the target_word column (0-based)
# --- End Configuration ---

def verify_csv_file(file_path: Path) -> bool:
    """
    Verifies a single CSV file for duplicate targets and ambiguous sources.
    Returns True if issues were found, False otherwise.
    """
    print(f"\n--- Verifying file: {file_path.name} ---")
    target_duplicates = defaultdict(set) # target_word -> {source_word1, source_word2,...}
    source_duplicates = defaultdict(set) # source_word -> {target_word1, target_word2,...}
    seen_pairs = set()                   # Stores (source, target) tuples to find full row duplicates
    row_duplicates_found = []            # List to store info about fully duplicated rows
    file_has_issues = False

    try:
        with file_path.open('r', encoding='utf-8', newline='') as csvfile:
            reader = csv.reader(csvfile)
            try:
                header = next(reader) # Skip header row
                if len(header) <= max(SOURCE_WORD_COL_INDEX, TARGET_WORD_COL_INDEX):
                    print(f"    [ERROR] Insufficient columns in header ({len(header)}). Expected at least {max(SOURCE_WORD_COL_INDEX, TARGET_WORD_COL_INDEX) + 1}.")
                    return True # Treat as a file with issues
            except StopIteration:
                print("    [WARNING] File is empty or contains only a header.")
                return False # Empty file is not an issue for duplicates

            line_num = 1 # Start counting after header
            for row in reader:
                line_num += 1
                try:
                    if len(row) <= max(SOURCE_WORD_COL_INDEX, TARGET_WORD_COL_INDEX):
                       print(f"    [WARNING] Line {line_num}: Skipping row due to insufficient columns ({len(row)}).")
                       continue

                    source_word = row[SOURCE_WORD_COL_INDEX].strip()
                    target_word = row[TARGET_WORD_COL_INDEX].strip()

                    if not source_word or not target_word:
                        print(f"    [WARNING] Line {line_num}: Empty source ('{source_word}') or target ('{target_word}') word.")
                        continue

                    # Check for full row duplicates (same source and target)
                    current_pair = (source_word, target_word)
                    if current_pair in seen_pairs:
                        row_duplicates_found.append((line_num, source_word, target_word))
                        file_has_issues = True
                    else:
                        seen_pairs.add(current_pair)

                    # Check for target_word duplicates (one target, multiple sources)
                    target_duplicates[target_word].add(source_word)

                    # Check for source_word duplicates (one source, multiple targets)
                    source_duplicates[source_word].add(target_word)

                except IndexError:
                    print(f"    [ERROR] Line {line_num}: Could not read columns. Row data: {row}")
                    file_has_issues = True
                    continue

    except FileNotFoundError:
        print(f"    [ERROR] File not found: {file_path}")
        return True # File not found is an issue
    except UnicodeDecodeError:
         print(f"    [ERROR] Could not read file {file_path.name} with UTF-8 encoding.")
         return True
    except Exception as e:
        print(f"    [ERROR] Unexpected error reading file {file_path.name}: {e}")
        return True

    # --- Report results for the file ---

    # Report target_word duplicates
    found_target_duplicates = False
    for target, sources in target_duplicates.items():
        if len(sources) > 1:
            if not found_target_duplicates:
                print("\n    [FOUND] Duplicate Targets (One target word used for multiple source words):")
                found_target_duplicates = True
                file_has_issues = True
            print(f"      - Target: '{target}' corresponds to Sources: {sorted(list(sources))}")

    # Report source_word duplicates
    found_source_duplicates = False
    for source, targets in source_duplicates.items():
        if len(targets) > 1:
            if not found_source_duplicates:
                print("\n    [FOUND] Ambiguous Sources (One source word has multiple target translations):")
                found_source_duplicates = True
                file_has_issues = True
            print(f"      - Source: '{source}' translates to Targets: {sorted(list(targets))}")

    # Report full row duplicates
    if row_duplicates_found:
        print("\n    [FOUND] Full Row Duplicates (Same Source and Target):")
        file_has_issues = True
        for line, source, target in row_duplicates_found:
             print(f"      - Line {line}: Source='{source}', Target='{target}'")


    if not file_has_issues:
        print("    No issues found.")

    return file_has_issues

def main():
    """
    Main function to find and verify CSV files.
    """
    if not MIGRATIONS_DIR.is_dir():
        print(f"[ERROR] Migrations directory not found: {MIGRATIONS_DIR}")
        sys.exit(1)

    print(f"Searching for CSV files in: {MIGRATIONS_DIR.resolve()}")
    csv_files = sorted(list(MIGRATIONS_DIR.glob("*.csv")))

    if not csv_files:
        print("No CSV files found.")
        sys.exit(0)

    print(f"Found {len(csv_files)} CSV file(s).")
    any_issues_found_globally = False

    for csv_file in csv_files:
        if verify_csv_file(csv_file):
            any_issues_found_globally = True

    print("\n--- Verification Complete ---")
    if any_issues_found_globally:
        print("Issues detected in one or more CSV files.")
        sys.exit(1) # Exit with error code for CI
    else:
        print("No duplicate/ambiguity issues found in CSV files.")
        sys.exit(0) # Successful exit

if __name__ == "__main__":
    main()