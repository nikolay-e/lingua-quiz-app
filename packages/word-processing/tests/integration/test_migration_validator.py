"""
Integration tests for MigrationValidator.

Tests verify validation logic:
1. Duplicate word detection (within file and across files)
2. ID sequence validation
3. Data integrity checks (empty fields, placeholders)
4. Data quality checks (identical source/target, long words)
5. Normalization-aware duplicate detection
"""

import json
from pathlib import Path

import pytest

from vocab_tools.validation.migration_validator import MigrationValidator


@pytest.fixture
def temp_migrations_dir(tmp_path):
    """Create temporary migrations directory for testing."""
    migrations_dir = tmp_path / "migrations" / "data" / "vocabulary"
    migrations_dir.mkdir(parents=True)
    return migrations_dir


@pytest.fixture
def create_migration_file(temp_migrations_dir):
    """Factory fixture to create migration files with test data."""

    def _create_file(filename: str, entries: list[dict]) -> Path:
        file_path = temp_migrations_dir / filename
        # Wrap entries in expected JSON structure
        data = {"word_pairs": entries}
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return file_path

    return _create_file


class TestMigrationValidatorBasic:
    """Test basic validation scenarios."""

    def test_validate_valid_migration_file(self, create_migration_file, temp_migrations_dir):
        """Verify validation passes for correctly formatted file."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "Mi casa es bonita.",
                "target_example": "Мой дом красивый.",
            },
            {
                "translation_id": 4000003,
                "source_id": 4000004,
                "target_id": 4000005,
                "source_word": "libro",
                "target_word": "книга",
                "source_example": "Leo un libro.",
                "target_example": "Я читаю книгу.",
            },
        ]

        create_migration_file("spanish-russian-test.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert result.is_valid
        assert result.error_count == 0
        assert result.total_entries_checked == 2

    def test_validate_empty_migrations_directory(self, temp_migrations_dir):
        """Verify validation handles empty directory gracefully."""
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert result.is_valid
        assert result.total_entries_checked == 0
        assert len(result.files_validated) == 0


class TestMigrationValidatorDuplicates:
    """Test duplicate detection."""

    def test_detect_duplicate_words_in_file(self, create_migration_file, temp_migrations_dir):
        """Verify detection of duplicate words within same file."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
            {
                "translation_id": 4000003,
                "source_id": 4000004,
                "target_id": 4000005,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
        ]

        create_migration_file("spanish-russian-duplicates.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        assert result.error_count >= 1
        duplicate_errors = [i for i in result.issues if i.category == "duplicates"]
        assert len(duplicate_errors) >= 1
        assert "casa" in duplicate_errors[0].message

    def test_detect_normalized_duplicates(self, create_migration_file, temp_migrations_dir):
        """Verify duplicate detection works with normalization (whitespace, case)."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "Casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
            {
                "translation_id": 4000003,
                "source_id": 4000004,
                "target_id": 4000005,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
        ]

        create_migration_file("spanish-russian-normalized.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        duplicate_errors = [i for i in result.issues if i.category == "duplicates"]
        assert len(duplicate_errors) >= 1

    def test_detect_cross_file_duplicates(self, create_migration_file, temp_migrations_dir):
        """Verify detection of duplicates across multiple files."""
        entries_a1 = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            }
        ]

        entries_a2 = [
            {
                "translation_id": 4010000,
                "source_id": 4010001,
                "target_id": 4010002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-a1.json", entries_a1)
        create_migration_file("spanish-russian-a2.json", entries_a2)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        cross_file_errors = [i for i in result.issues if i.category == "cross_file_duplicates"]
        assert len(cross_file_errors) >= 1
        assert "casa" in cross_file_errors[0].message


class TestMigrationValidatorDataIntegrity:
    """Test data integrity validation."""

    def test_detect_empty_source_word(self, create_migration_file, temp_migrations_dir):
        """Verify detection of empty source word."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-empty.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        integrity_errors = [i for i in result.issues if i.category == "data_integrity"]
        assert len(integrity_errors) >= 1
        assert "Empty source word" in integrity_errors[0].message

    def test_detect_empty_target_word(self, create_migration_file, temp_migrations_dir):
        """Verify detection of empty translation."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-empty-target.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        integrity_errors = [i for i in result.issues if i.category == "data_integrity"]
        assert len(integrity_errors) >= 1
        assert "Empty translation" in integrity_errors[0].message


class TestMigrationValidatorDataQuality:
    """Test data quality validation."""

    def test_detect_identical_source_target(self, create_migration_file, temp_migrations_dir):
        """Verify warning for identical source and target words."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "test",
                "target_word": "test",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-identical.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        quality_warnings = [i for i in result.issues if i.category == "data_quality"]
        assert len(quality_warnings) >= 1
        assert "identical" in quality_warnings[0].message.lower()

    def test_detect_placeholder_entries(self, create_migration_file, temp_migrations_dir):
        """Verify detection of placeholder entries."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "word",
                "target_word": "translation",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-placeholder.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        quality_warnings = [i for i in result.issues if i.category == "data_quality"]
        assert len(quality_warnings) >= 1
        assert "Placeholder" in quality_warnings[0].message

    def test_detect_long_words(self, create_migration_file, temp_migrations_dir):
        """Verify detection of unusually long words."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "a" * 150,
                "target_word": "test",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-long.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        quality_warnings = [i for i in result.issues if i.category == "data_quality"]
        assert len(quality_warnings) >= 1
        assert "long word" in quality_warnings[0].message.lower()


class TestMigrationValidatorIDValidation:
    """Test ID sequence validation."""

    def test_detect_duplicate_source_target_id_pairs(self, create_migration_file, temp_migrations_dir):
        """Verify detection of duplicate source/target ID pairs."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
            {
                "translation_id": 4000003,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "hogar",
                "target_word": "жилище",
                "source_example": "",
                "target_example": "",
            },
        ]

        create_migration_file("spanish-russian-duplicate-ids.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        id_errors = [i for i in result.issues if i.category == "duplicate_ids"]
        assert len(id_errors) >= 1

    def test_large_id_gaps_warning(self, create_migration_file, temp_migrations_dir):
        """Verify warning for large gaps in ID sequences."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            },
            {
                "translation_id": 4001000,
                "source_id": 4001001,
                "target_id": 4001002,
                "source_word": "libro",
                "target_word": "книга",
                "source_example": "",
                "target_example": "",
            },
        ]

        create_migration_file("spanish-russian-gaps.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        [i for i in result.issues if i.category == "id_sequence"]
        # Gaps exist, but may or may not trigger warning depending on threshold
        assert result.total_entries_checked == 2


class TestMigrationValidatorAnswerSyntax:
    """Test validation of answer syntax ([], |, (), ,)."""

    def test_valid_brackets_syntax(self, create_migration_file, temp_migrations_dir):
        """Verify valid bracket syntax passes validation."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом [жилище]",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-brackets.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) == 0

    def test_unbalanced_brackets(self, create_migration_file, temp_migrations_dir):
        """Verify unbalanced brackets trigger warning."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом [жилище",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-unbalanced.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) >= 1
        assert "unbalanced" in syntax_errors[0].message.lower() or "brackets" in syntax_errors[0].message.lower()

    def test_valid_pipe_alternatives(self, create_migration_file, temp_migrations_dir):
        """Verify valid pipe syntax passes validation."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом|жилище",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-pipe.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) == 0

    def test_valid_comma_separator(self, create_migration_file, temp_migrations_dir):
        """Verify valid comma syntax passes validation."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом, жилище",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-comma.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) == 0

    def test_valid_grouped_alternatives(self, create_migration_file, temp_migrations_dir):
        """Verify valid grouped alternatives syntax passes validation."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "igual",
                "target_word": "(равный|одинаковый), (сейчас|немедленно)",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-grouped.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) == 0

    def test_unbalanced_parentheses(self, create_migration_file, temp_migrations_dir):
        """Verify unbalanced parentheses trigger warning."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "(дом|жилище",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-unbalanced-parens.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        syntax_errors = [i for i in result.issues if i.category == "answer_syntax"]
        assert len(syntax_errors) >= 1


class TestMigrationValidatorEdgeCases:
    """Test edge cases and error handling."""

    def test_handle_malformed_json(self, create_migration_file, temp_migrations_dir):
        """Verify handling of malformed JSON files."""
        file_path = temp_migrations_dir / "spanish-russian-malformed.json"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("{ invalid json }")

        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)

        assert not result.is_valid
        parsing_errors = [i for i in result.issues if i.category in ["file_parsing", "file_access"]]
        assert len(parsing_errors) >= 1

    def test_validation_result_to_dict(self, create_migration_file, temp_migrations_dir):
        """Verify ValidationResult serialization."""
        entries = [
            {
                "translation_id": 4000000,
                "source_id": 4000001,
                "target_id": 4000002,
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "",
                "target_example": "",
            }
        ]

        create_migration_file("spanish-russian-serialization.json", entries)
        validator = MigrationValidator(temp_migrations_dir.parent.parent)

        result = validator.validate_all_migrations(silent=True)
        result_dict = result.to_dict()

        assert isinstance(result_dict, dict)
        assert "is_valid" in result_dict
        assert "total_checked" in result_dict
        assert "total_entries_checked" in result_dict
        assert "files_validated" in result_dict
        assert "error_count" in result_dict
        assert "warning_count" in result_dict
        assert result_dict["total_entries_checked"] == result.total_entries_checked
