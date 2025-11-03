"""
Database migration validator for LinguaQuiz vocabulary files.

Validates migration files for data integrity, uniqueness constraints,
ID consistency, and overall database quality.
"""

from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from ..config.config_loader import get_config_loader
from ..core.base_normalizer import get_universal_normalizer
from ..core.database_parser import VocabularyEntry, VocabularyFileParser
from .base_validation import BaseValidationIssue, BaseValidationResult


@dataclass
class ValidationIssue(BaseValidationIssue):
    """Represents a validation issue found during migration validation."""

    message: str = ""

    def get_message(self) -> str:
        """Get the issue message."""
        return self.message

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        base_dict = super().to_dict()
        base_dict["message"] = self.message
        return base_dict


@dataclass
class ValidationResult(BaseValidationResult):
    """Complete results of migration validation."""

    @property
    def total_entries_checked(self) -> int:
        """Alias for backward compatibility."""
        return self.total_checked

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        result = super().to_dict()
        result["total_entries_checked"] = self.total_entries_checked
        return result


class MigrationValidator:
    """
    Validates migration files for vocabulary database integrity.

    Performs comprehensive validation including:
    - Duplicate word detection
    - ID sequence validation
    - Data integrity checks
    - Cross-language consistency
    """

    def __init__(self, migrations_directory: Path | None = None):
        """
        Initialize the migration validator.

        Args:
            migrations_directory: Path to migrations directory
        """
        self.db_parser = VocabularyFileParser(migrations_directory)
        # Initialize normalizers for supported languages
        supported_languages = ["en", "de", "es"]
        config_loader = get_config_loader()
        self.normalizers = {lang: get_universal_normalizer(lang, config_loader) for lang in supported_languages}

    def validate_all_migrations(self, silent: bool = False) -> ValidationResult:
        """
        Validate all vocabulary migration files.

        Args:
            silent: If True, suppress all output during validation

        Returns:
            Complete validation results
        """
        if not silent:
            print("🔍 Starting comprehensive migration validation...")

        result = ValidationResult(total_checked=0)

        # Discover migration files dynamically
        discovered_files = self.db_parser.discover_migration_files()

        # Validate each language's migration files
        for language, filenames in discovered_files.items():
            for filename in filenames:
                try:
                    if not silent:
                        print(f"  Validating {language.upper()} ({filename})...")
                    language_result = self._validate_language_file(language, filename)

                    # Merge results
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

        # Cross-language validation removed - was empty placeholder

        return result

    def _validate_language_file(self, language: str, filename: str) -> ValidationResult:
        """
        Validate a single language migration file.

        Args:
            language: Language code
            filename: Migration filename

        Returns:
            Validation results for this file
        """
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

        # Track data for validation
        seen_words: dict[str, list[int]] = defaultdict(list)
        seen_ids: dict[str, set[int]] = defaultdict(set)
        duplicate_id_pairs: dict[tuple[int, int], list[int]] = defaultdict(list)

        # Validate each entry
        for entry in entries:
            # Validate individual entry
            entry_issues = self._validate_entry(entry, filename, normalizer)
            result.issues.extend(entry_issues)

            # Track for duplicate detection (exact source_word match only)
            seen_words[entry.source_word].append(entry.translation_id)

            # Track IDs
            seen_ids["translation"].add(entry.translation_id)
            seen_ids["source_word"].add(entry.source_word_id)
            seen_ids["target_word"].add(entry.target_word_id)

            # Track duplicate source/target ID pairs
            id_pair = (entry.source_word_id, entry.target_word_id)
            duplicate_id_pairs[id_pair].append(entry.translation_id)

        # Check for duplicate words
        duplicates = {word: ids for word, ids in seen_words.items() if len(ids) > 1}
        if duplicates:
            for word, ids in duplicates.items():
                result.issues.append(
                    ValidationIssue(
                        severity="error",
                        category="duplicates",
                        message=f"Duplicate word '{word}' found in entries: {ids}",
                        file_name=filename,
                    )
                )

        # Check for duplicate source/target ID pairs
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

        # Validate ID sequences
        id_issues = self._validate_id_sequences(language, filename, seen_ids)
        result.issues.extend(id_issues)

        return result

    def _validate_entry(self, entry: VocabularyEntry, filename: str, normalizer) -> list[ValidationIssue]:
        """
        Validate a single vocabulary entry.

        Args:
            entry: Entry to validate
            filename: Source filename
            normalizer: Language-specific normalizer

        Returns:
            List of validation issues found
        """
        issues = []

        # Check for empty required fields
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

        # Check for suspicious patterns
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

        # Check for placeholder entries
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

        # Check word length
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

        return issues

    def _validate_id_sequences(self, language: str, filename: str, seen_ids: dict[str, set[int]]) -> list[ValidationIssue]:
        """
        Validate ID sequences for internal consistency (no hardcoded expectations).

        Args:
            language: Language code
            filename: Migration filename
            seen_ids: Dictionary of ID types to sets of IDs

        Returns:
            List of ID-related validation issues (only for actual sequence problems)
        """
        issues = []

        # Only validate for actual sequence problems, not arbitrary expected offsets
        # The file determines its own ID ranges - we just check for gaps and consistency

        for id_type, id_set in seen_ids.items():
            if not id_set or len(id_set) < 2:
                continue

            # Check for large gaps that might indicate problems
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

            # Only report if there are significant gaps (potential data issues)
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

    def print_validation_report(self, result: ValidationResult, detailed: bool = True):
        """
        Print a formatted validation report.

        Args:
            result: Validation results to report
            detailed: Whether to show detailed issue breakdown
        """
        print(f"\n{'=' * 80}")
        print("📋 MIGRATION VALIDATION REPORT")
        print(f"{'=' * 80}")

        print("📊 Summary:")
        print(f"   • Files validated: {len(result.files_validated)}")
        print(f"   • Total entries checked: {result.total_entries_checked:,}")
        print(f"   • Errors found: {result.error_count}")
        print(f"   • Warnings found: {result.warning_count}")

        if result.is_valid:
            print("\n✅ Validation PASSED - No critical errors found")
        else:
            print(f"\n❌ Validation FAILED - {result.error_count} errors must be fixed")

        if detailed and result.issues:
            # Group issues by severity and category
            errors = [i for i in result.issues if i.severity == "error"]
            warnings = [i for i in result.issues if i.severity == "warning"]

            if errors:
                print(f"\n🚨 ERRORS ({len(errors)}):")
                for i, error in enumerate(errors[:20], 1):  # Show first 20
                    print(f"   {i:2d}. {error.message} [{error.file_name}]")
                if len(errors) > 20:
                    print(f"   ... and {len(errors) - 20} more errors")

            if warnings:
                print(f"\n⚠️  WARNINGS ({len(warnings)}):")
                for i, warning in enumerate(warnings[:10], 1):  # Show first 10
                    print(f"   {i:2d}. {warning.message} [{warning.file_name}]")
                if len(warnings) > 10:
                    print(f"   ... and {len(warnings) - 10} more warnings")

        # Duplicate information is already shown in the issues section above

        print(f"\n{'=' * 80}")
