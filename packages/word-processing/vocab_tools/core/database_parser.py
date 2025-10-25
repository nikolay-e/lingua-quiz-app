"""
Database migration file parser for LinguaQuiz vocabulary tools.

Handles extraction and parsing of vocabulary data from JSON vocabulary files.
"""

from dataclasses import dataclass
import json
from pathlib import Path


@dataclass
class VocabularyEntry:
    """Represents a single vocabulary entry from the database."""

    translation_id: int
    source_word_id: int
    target_word_id: int
    source_word: str
    target_word: str
    source_example: str
    target_example: str

    def __post_init__(self):
        """Clean up the entry data after initialization."""
        # No special processing needed for JSON data - strings are already properly formatted


class VocabularyFileParser:
    """Parses JSON vocabulary files to extract vocabulary data."""

    def __init__(self, migrations_directory: Path | None = None):
        self.migrations_dir = migrations_directory or self._find_migrations_directory()

    def _find_migrations_directory(self) -> Path:
        """
        Try to auto-detect the project root that contains data/vocabulary.
        Searches upwards from this file for a .git directory.
        """
        current_path = Path.cwd()
        while not (current_path / ".git").exists() and current_path != current_path.parent:
            current_path = current_path.parent
        if (current_path / ".git").exists():
            migrations_path = current_path / "packages" / "backend" / "migrations"
            if migrations_path.is_dir():
                return migrations_path
        raise FileNotFoundError(
            "Could not auto-detect migrations directory. Please specify the path to the migrations directory using --migrations-dir."
        )

    def discover_migration_files(self) -> dict[str, list[str]]:
        vocabulary_dir = self.migrations_dir / "data" / "vocabulary"
        if not vocabulary_dir.exists():
            return {}

        discovered = {}
        for json_file in vocabulary_dir.glob("*.json"):
            filename = json_file.name
            # Extract language from filename pattern like "english-russian-a2.json"
            parts = filename.replace(".json", "").split("-")
            if len(parts) >= 2:
                source_lang = parts[0]
                if source_lang in ["english", "german", "spanish"]:
                    lang_code = {"english": "en", "german": "de", "spanish": "es"}[source_lang]
                    if lang_code not in discovered:
                        discovered[lang_code] = []
                    discovered[lang_code].append(filename)

        return discovered

    def parse_migration_file(self, filename: str) -> list[VocabularyEntry]:
        # Use standardized vocabulary directory location
        file_path = self.migrations_dir / "data" / "vocabulary" / filename

        if not file_path.exists():
            raise FileNotFoundError(f"JSON vocabulary file not found: {file_path}")

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            raise ValueError(f"Error reading JSON file {filename}: {e}")

        return self._extract_entries_from_json(data, filename)

    def _extract_entries_from_json(self, data: dict, filename: str) -> list[VocabularyEntry]:
        entries = []

        if "word_pairs" not in data:
            raise ValueError(f"JSON file {filename} missing 'word_pairs' field")

        for word_pair in data["word_pairs"]:
            try:
                entry = VocabularyEntry(
                    translation_id=word_pair["translation_id"],
                    source_word_id=word_pair["source_id"],
                    target_word_id=word_pair["target_id"],
                    source_word=word_pair["source_word"],
                    target_word=word_pair["target_word"],
                    source_example=word_pair.get("source_example", ""),
                    target_example=word_pair.get("target_example", ""),
                )
                entries.append(entry)
            except KeyError as e:
                raise ValueError(f"JSON file {filename} has malformed word_pair missing field: {e}")

        return entries
