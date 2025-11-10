import json
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from ..config.config_loader import get_config_loader
from ..core.base_normalizer import get_universal_normalizer
from ..core.database_parser import VocabularyEntry, VocabularyFileParser
from ..core.lemmatization_service import get_lemmatization_service
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
        # Initialize normalizers and lemmatizers for supported languages
        supported_languages = ["en", "de", "es"]
        config_loader = get_config_loader()
        self.normalizers = {lang: get_universal_normalizer(lang, config_loader) for lang in supported_languages}
        self.lemmatizers = {lang: get_lemmatization_service(lang) for lang in supported_languages}

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
        lemmatizer = self.lemmatizers[language]

        # Track duplicates by lemma+POS, but exclude pronouns and functional words
        seen_words: dict[str, list[tuple[str, str]]] = defaultdict(list)

        for entry in entries:
            entry_issues = self._validate_entry(entry, filename, normalizer)
            result.issues.extend(entry_issues)

            # Use lemmatization + POS for duplicate detection
            normalized_word = normalizer.normalize(entry.source_word)
            lemma_with_pos = lemmatizer.lemmatize_with_pos(normalized_word)

            # Store lemma+POS as key
            for lemma, pos in lemma_with_pos:
                key = f"{lemma}:{pos}"
                seen_words[key].append((entry.source_word, pos))

        # Check for duplicates (same lemma AND same POS)
        # Exclude pronouns (PRON) - they often have same lemma but different functions
        # (él, ella, lo, se should NOT be considered duplicates)
        duplicates = {key: words for key, words in seen_words.items() if len(words) > 1}
        if duplicates:
            for key, word_pos_pairs in duplicates.items():
                lemma, pos = key.split(":", 1)

                # Skip pronouns and determiners - they're intentionally different despite same lemma
                if pos in ["PRON", "DET"]:
                    continue

                original_variants = [word for word, _ in word_pos_pairs]
                variants_str = ", ".join(f"'{v}'" for v in set(original_variants))
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        category="duplicates",
                        message=f"Duplicate word (lemma: '{lemma}', POS: {pos}, variants: {variants_str}) found {len(word_pos_pairs)} times",
                        file_name=filename,
                    )
                )

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
                )
            )

        if not entry.target_word.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message="Empty translation",
                    file_name=filename,
                )
            )

        if entry.source_word == entry.target_word:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message=f"Source word and translation are identical: '{entry.source_word}'",
                    file_name=filename,
                )
            )

        if entry.source_word == "word" and entry.target_word == "translation":
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message="Placeholder entry detected",
                    file_name=filename,
                )
            )

        if "[translation needed" in entry.target_word.lower():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message=f"Translation needed for word: '{entry.source_word}'",
                    file_name=filename,
                )
            )

        if len(entry.source_word) > 100:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="data_quality",
                    message=f"Unusually long word: '{entry.source_word[:50]}...'",
                    file_name=filename,
                )
            )

        if not entry.source_example or not entry.source_example.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message=f"Empty source_example for word: '{entry.source_word}'",
                    file_name=filename,
                )
            )

        if not entry.target_example or not entry.target_example.strip():
            issues.append(
                ValidationIssue(
                    severity="error",
                    category="data_integrity",
                    message=f"Empty target_example for word: '{entry.source_word}'",
                    file_name=filename,
                )
            )

        syntax_issues = self._validate_answer_syntax(entry.target_word, filename)
        issues.extend(syntax_issues)

        return issues

    def _validate_answer_syntax(self, target_word: str, filename: str) -> list[ValidationIssue]:
        issues = []

        bracket_count = target_word.count("[") - target_word.count("]")
        if bracket_count != 0:
            issues.append(
                ValidationIssue(
                    severity="warning",
                    category="answer_syntax",
                    message=f"Unbalanced brackets in target_word: '{target_word}'",
                    file_name=filename,
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
                )
            )

        return issues

    def _validate_cross_file_duplicates(self, discovered_files: dict[str, list[str]]) -> list[ValidationIssue]:
        issues = []

        for language, filenames in discovered_files.items():
            if language not in self.normalizers:
                continue

            normalizer = self.normalizers[language]
            lemmatizer = self.lemmatizers[language]
            global_seen_words: dict[str, list[tuple[str, str]]] = defaultdict(list)

            for filename in filenames:
                try:
                    entries = self.db_parser.parse_migration_file(filename)
                    for entry in entries:
                        # Use lemmatization for cross-file duplicate detection
                        normalized = normalizer.normalize(entry.source_word)
                        lemmatized = lemmatizer.lemmatize(normalized)
                        global_seen_words[lemmatized].append((filename, entry.source_word))
                except (FileNotFoundError, json.JSONDecodeError, ValueError):
                    continue

            for lemmatized_word, occurrences in global_seen_words.items():
                if len(occurrences) <= 1:
                    continue

                files_with_word = defaultdict(int)
                original_variants = set()
                for filename, original_word in occurrences:
                    files_with_word[filename] += 1
                    original_variants.add(original_word)

                if len(files_with_word) > 1:
                    file_list = ", ".join(f"{fname}({count}x)" for fname, count in files_with_word.items())
                    variants_str = ", ".join(f"'{v}'" for v in original_variants)
                    issues.append(
                        ValidationIssue(
                            severity="error",
                            category="cross_file_duplicates",
                            message=f"Word '{lemmatized_word}' (variants: {variants_str}) appears in multiple files: {file_list}",
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
