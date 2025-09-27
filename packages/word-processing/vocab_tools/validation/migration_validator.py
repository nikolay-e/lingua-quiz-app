"""
Database migration validator for LinguaQuiz vocabulary files.

Validates migration files for data integrity, uniqueness constraints,
ID consistency, and overall database quality.
"""

from collections import defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from ..core.database_parser import VocabularyFileParser, VocabularyEntry
from ..core.word_normalizer import get_normalizer


@dataclass
class ValidationIssue:
    """Represents a validation issue found during migration validation."""

    severity: str  # 'error' or 'warning'
    category: str
    message: str
    file_name: str
    entry_id: Optional[int] = None

    def __str__(self) -> str:
        location = f"{self.file_name}"
        if self.entry_id:
            location += f" (ID: {self.entry_id})"
        return f"{self.severity.upper()}: {self.message} [{location}]"


@dataclass
class ValidationResult:
    """Complete results of migration validation."""

    total_entries_checked: int
    files_validated: List[str] = field(default_factory=list)
    issues: List[ValidationIssue] = field(default_factory=list)

    @property
    def error_count(self) -> int:
        """Get count of error-level issues."""
        return len([i for i in self.issues if i.severity == "error"])

    @property
    def warning_count(self) -> int:
        """Get count of warning-level issues."""
        return len([i for i in self.issues if i.severity == "warning"])

    @property
    def is_valid(self) -> bool:
        """Check if validation passed (no errors)."""
        return self.error_count == 0

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "is_valid": self.is_valid,
            "total_entries_checked": self.total_entries_checked,
            "files_validated": self.files_validated,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "issues": [
                {
                    "severity": issue.severity,
                    "category": issue.category,
                    "message": issue.message,
                    "file_name": issue.file_name,
                    "entry_id": issue.entry_id,
                }
                for issue in self.issues
            ],
        }


class MigrationValidator:
    """
    Validates migration files for vocabulary database integrity.

    Performs comprehensive validation including:
    - Duplicate word detection
    - ID sequence validation
    - Data integrity checks
    - Cross-language consistency
    """

    def __init__(self, migrations_directory: Optional[Path] = None):
        """
        Initialize the migration validator.

        Args:
            migrations_directory: Path to migrations directory
        """
        self.db_parser = VocabularyFileParser(migrations_directory)
        # Initialize normalizers for supported languages
        supported_languages = ["en", "de", "es"]
        self.normalizers = {lang: get_normalizer(lang) for lang in supported_languages}

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

        result = ValidationResult(total_entries_checked=0)

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
                    result.total_entries_checked += (
                        language_result.total_entries_checked
                    )

                except Exception as e:
                    error_issue = ValidationIssue(
                        severity="error",
                        category="file_access",
                        message=f"Failed to validate {filename}: {str(e)}",
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
            result = ValidationResult(total_entries_checked=0)
            result.issues.append(
                ValidationIssue(
                    severity="error",
                    category="file_parsing",
                    message=f"Cannot parse migration file: {str(e)}",
                    file_name=filename,
                )
            )
            return result

        result = ValidationResult(total_entries_checked=len(entries))
        normalizer = self.normalizers[language]

        # Track data for validation
        seen_words: Dict[str, List[int]] = defaultdict(list)
        seen_ids: Dict[str, Set[int]] = defaultdict(set)
        duplicate_id_pairs: Dict[Tuple[int, int], List[int]] = defaultdict(list)

        # Validate each entry
        for entry in entries:
            # Validate individual entry
            entry_issues = self._validate_entry(entry, filename, normalizer)
            result.issues.extend(entry_issues)

            # Track for duplicate detection (handle all word variants)
            word_variants = normalizer.extract_word_variants(entry.source_word)
            for variant in word_variants:
                if variant:
                    seen_words[variant].append(entry.translation_id)

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
        duplicate_pairs = {
            pair: ids for pair, ids in duplicate_id_pairs.items() if len(ids) > 1
        }
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

    def _validate_entry(
        self, entry: VocabularyEntry, filename: str, normalizer
    ) -> List[ValidationIssue]:
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

    def _validate_id_sequences(
        self, language: str, filename: str, seen_ids: Dict[str, Set[int]]
    ) -> List[ValidationIssue]:
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
            if max_gap > 100:  # Arbitrary threshold for "suspicious" gaps
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
        print(f"\n{'='*80}")
        print("📋 MIGRATION VALIDATION REPORT")
        print(f"{'='*80}")

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

        print(f"\n{'='*80}")
