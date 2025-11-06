from collections import defaultdict
from dataclasses import dataclass
import json
from pathlib import Path

from ..config.config_loader import get_config_loader
from ..core.base_normalizer import get_universal_normalizer
from ..core.database_parser import VocabularyEntry, VocabularyFileParser
from .base_validation import BaseValidationIssue, BaseValidationResult


@dataclass
class ValidationIssue(BaseValidationIssue):
    message: str = ""

    def get_message(self) -> str:
        return self.message

    def to_dict(self) -> dict:
        base_dict = super().to_dict()
        base_dict["message"] = self.message
        return base_dict


@dataclass
class ValidationResult(BaseValidationResult):
    @property
    def total_entries_checked(self) -> int:
        return self.total_checked

    def to_dict(self) -> dict:
        result = super().to_dict()
        result["total_entries_checked"] = self.total_entries_checked
        return result


class MigrationValidator:
    def __init__(self, migrations_directory: Path | None = None):
        self.db_parser = VocabularyFileParser(migrations_directory)
        # Initialize normalizers for supported languages
        supported_languages = ["en", "de", "es"]
        config_loader = get_config_loader()
        self.normalizers = {lang: get_universal_normalizer(lang, config_loader) for lang in supported_languages}

    def validate_single_file(self, file_path: Path, silent: bool = False) -> ValidationResult:
        filename = file_path.name

        parts = filename.replace(".json", "").split("-")
        if len(parts) >= 2:
            language = parts[0]
        else:
            raise ValueError(f"Cannot extract language from filename: {filename}")

        language_map = {"spanish": "es", "german": "de", "english": "en", "russian": "ru"}
        lang_code = language_map.get(language.lower(), language.lower())

        if not silent:
            print(f"Validating {filename}...")

        return self._validate_language_file(lang_code, filename)

    def validate_all_migrations(self, silent: bool = False) -> ValidationResult:
        if not silent:
            print("Starting comprehensive migration validation...")

        result = ValidationResult(total_checked=0)

        discovered_files = self.db_parser.discover_migration_files()

        for language, filenames in discovered_files.items():
            for filename in filenames:
                try:
                    if not silent:
                        print(f"  Validating {language.upper()} ({filename})...")
                    language_result = self._validate_language_file(language, filename)

                    result.files_validated.append(filename)
                    result.issues.extend(language_result.issues)
                    result.total_checked += language_result.total_checked

                except Exception as e:
                    error_issue = ValidationIssue(
                        severity="error",
                        category="file_access",
                        message=f"Failed to validate {filename}: {e!s}",
                        file_name=filename,
                    )
                    result.issues.append(error_issue)

        if not silent:
            print("  Validating cross-file duplicates...")
        cross_file_issues = self._validate_cross_file_duplicates(discovered_files)
        result.issues.extend(cross_file_issues)

        return result

    def _validate_language_file(self, language: str, filename: str) -> ValidationResult:
        try:
            entries = self.db_parser.parse_migration_file(filename)
        except Exception as e:
            result = ValidationResult(total_checked=0)
            result.issues.append(
                ValidationIssue(
                    severity="error",
                    category="file_parsing",
                    message=f"Cannot parse migration file: {e!s}",
                    file_name=filename,
                )
            )
            return result

        result = ValidationResult(total_checked=len(entries))
        normalizer = self.normalizers[language]

        seen_words: dict[str, list[int]] = defaultdict(list)
        seen_words_original: dict[str, list[str]] = defaultdict(list)
        seen_ids: dict[str, set[int]] = defaultdict(set)
        duplicate_id_pairs: dict[tuple[int, int], list[int]] = defaultdict(list)

        for entry in entries:
            entry_issues = self._validate_entry(entry, filename, normalizer)
            result.issues.extend(entry_issues)

            normalized_word = normalizer.normalize(entry.source_word)
            seen_words[normalized_word].append(entry.translation_id)
            seen_words_original[normalized_word].append(entry.source_word)

            seen_ids["translation"].add(entry.translation_id)
            seen_ids["source_word"].add(entry.source_word_id)
            seen_ids["target_word"].add(entry.target_word_id)

            id_pair = (entry.source_word_id, entry.target_word_id)
            duplicate_id_pairs[id_pair].append(entry.translation_id)

        duplicates = {word: ids for word, ids in seen_words.items() if len(ids) > 1}
        if duplicates:
            for normalized_word, ids in duplicates.items():
                original_variants = seen_words_original[normalized_word]
                variants_str = ", ".join(f"'{v}'" for v in set(original_variants))
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        category="duplicates",
                        message=f"Duplicate word (normalized: '{normalized_word}', variants: {variants_str}) found in entries: {ids}",
                        file_name=filename,
                    )
                )

        duplicate_pairs = {pair: ids for pair, ids in duplicate_id_pairs.items() if len(ids) > 1}
        if duplicate_pairs:
            for (source_id, target_id), translation_ids in duplicate_pairs.items():
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        category="duplicate_ids",
                        message=f"Duplicate source/target ID pair ({source_id}, {target_id}) found in translations: {translation_ids}",
                        file_name=filename,
                    )
                )

        id_issues = self._validate_id_sequences(language, filename, seen_ids)
        result.issues.extend(id_issues)

        return result

    def _validate_entry(self, entry: VocabularyEntry, filename: str, normalizer) -> list[ValidationIssue]:
        issues = []

        if not entry.source_word.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message="Empty source word",
                    file_name=filename,
                    entry_id=entry.translation_id,
                )
            )

        if not entry.target_word.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message="Empty translation",
                    file_name=filename,
                    entry_id=entry.translation_id,
                )
            )

        if entry.source_word == entry.target_word:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message=f"Source word and translation are identical: '{entry.source_word}'",
                    file_name=filename,
                    entry_id=entry.translation_id,
                )
            )

        if entry.source_word == "word" and entry.target_word == "translation":
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message="Placeholder entry detected",
                    file_name=filename,
                    entry_id=entry.translation_id,
                )
            )

        if len(entry.source_word) > 100:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message=f"Unusually long word: '{entry.source_word[:50]}...'",
                    file_name=filename,
                    entry_id=entry.translation_id,
                )
            )

        syntax_issues = self._validate_answer_syntax(entry.target_word, filename, entry.translation_id)
        issues.extend(syntax_issues)

        return issues

    def _validate_answer_syntax(self, target_word: str, filename: str, entry_id: int) -> list[ValidationIssue]:
        issues = []

        bracket_count = target_word.count("[") - target_word.count("]")
        if bracket_count != 0:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="answer_syntax",
                    message=f"Unbalanced brackets in target_word: '{target_word}'",
                    file_name=filename,
                    entry_id=entry_id,
                )
            )

        paren_count = target_word.count("(") - target_word.count(")")
        if paren_count != 0:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="answer_syntax",
                    message=f"Unbalanced parentheses in target_word: '{target_word}'",
                    file_name=filename,
                    entry_id=entry_id,
                )
            )

        return issues

    def _validate_id_sequences(self, language: str, filename: str, seen_ids: dict[str, set[int]]) -> list[ValidationIssue]:
        issues = []

        for id_type, id_set in seen_ids.items():
            if not id_set or len(id_set) < 2:
                continue

            sorted_ids = sorted(id_set)
            max_gap = 0
            gap_count = 0

            for i in range(len(sorted_ids) - 1):
                current_id = sorted_ids[i]
                next_id = sorted_ids[i + 1]
                gap = next_id - current_id - 1

                if gap > 0:
                    gap_count += 1
                    max_gap = max(max_gap, gap)

            config_loader = get_config_loader()
            gap_threshold = config_loader.get_analysis_defaults().get("id_gap_threshold", 100)

            if max_gap > gap_threshold:
                issues.append(
                    ValidationIssue(
                        severity="warning",
                        category="id_sequence",
                        message=f"{id_type} IDs have large gaps (max gap: {max_gap}), check for missing data",
                        file_name=filename,
                    )
                )

        return issues

    def _validate_cross_file_duplicates(self, discovered_files: dict[str, list[str]]) -> list[ValidationIssue]:
        issues = []

        for language, filenames in discovered_files.items():
            if language not in self.normalizers:
                continue

            normalizer = self.normalizers[language]
            global_seen_words: dict[str, list[tuple[str, int, str]]] = defaultdict(list)

            for filename in filenames:
                try:
                    entries = self.db_parser.parse_migration_file(filename)
                    for entry in entries:
                        normalized = normalizer.normalize(entry.source_word)
                        global_seen_words[normalized].append((filename, entry.translation_id, entry.source_word))
                except (FileNotFoundError, json.JSONDecodeError, ValueError):
                    continue

            for normalized_word, occurrences in global_seen_words.items():
                if len(occurrences) <= 1:
                    continue

                files_with_word = defaultdict(list)
                original_variants = set()
                for filename, translation_id, original_word in occurrences:
                    files_with_word[filename].append(translation_id)
                    original_variants.add(original_word)

                if len(files_with_word) > 1:
                    file_list = ", ".join(f"{fname}:{ids}" for fname, ids in files_with_word.items())
                    variants_str = ", ".join(f"'{v}'" for v in original_variants)
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            category="cross_file_duplicates",
                            message=f"Word '{normalized_word}' (variants: {variants_str}) appears in multiple files: {file_list}",
                            file_name=", ".join(files_with_word.keys()),
                        )
                    )

        return issues

    def print_validation_report(self, result: ValidationResult, detailed: bool = True):
        print(f"\n{'=' * 80}")
        print("MIGRATION VALIDATION REPORT")
        print(f"{'=' * 80}")

        print("Summary:")
        print(f"   • Files validated: {len(result.files_validated)}")
        print(f"   • Total entries checked: {result.total_entries_checked:,}")
        print(f"   • Errors found: {result.error_count}")
        print(f"   • Warnings found: {result.warning_count}")

        if result.is_valid:
            print("\nValidation PASSED - No critical errors found")
        else:
            print(f"\nValidation FAILED - {result.error_count} errors must be fixed")

        if detailed and result.issues:
            errors = [i for i in result.issues if i.severity == "error"]
            warnings = [i for i in result.issues if i.severity == "warning"]

            if errors:
                print(f"\n ERRORS ({len(errors)}):")
                for i, error in enumerate(errors[:20], 1):
                    print(f"   {i:2d}. {error.message} [{error.file_name}]")
                if len(errors) > 20:
                    print(f"   ... and {len(errors) - 20} more errors")

            if warnings:
                print(f"\n⚠️  WARNINGS ({len(warnings)}):")
                for i, warning in enumerate(warnings[:10], 1):
                    print(f"   {i:2d}. {warning.message} [{warning.file_name}]")
                if len(warnings) > 10:
                    print(f"   ... and {len(warnings) - 10} more warnings")

        print(f"\n{'=' * 80}")
