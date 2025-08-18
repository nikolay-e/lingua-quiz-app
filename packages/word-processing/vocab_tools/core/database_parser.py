"""
Database migration file parser for LinguaQuiz vocabulary tools.

Handles extraction and parsing of vocabulary data from JSON vocabulary files.
"""

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional


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
        # Unescape SQL quotes
        self.source_word = self.source_word.replace("''", "'")
        self.target_word = self.target_word.replace("''", "'")
        self.source_example = self.source_example.replace("''", "'")
        self.target_example = self.target_example.replace("''", "'")


class DatabaseParser:
    """
    Parses SQL migration files to extract vocabulary data.

    Handles the extraction of vocabulary entries from SQL INSERT statements
    in migration files following the LinguaQuiz database schema.
    """

    def __init__(self, migrations_directory: Optional[Path] = None):
        """
        Initialize the database parser.

        Args:
            migrations_directory: Path to migrations directory. If None,
                                auto-detects based on current location.
        """
        self.migrations_dir = migrations_directory or self._find_migrations_directory()

    def _find_migrations_directory(self) -> Path:
        """
        Get the hardcoded migrations directory location.

        Returns:
            Path to migrations directory

        Raises:
            FileNotFoundError: If migrations directory cannot be found
        """
        # Hardcoded path relative to this file
        current_dir = Path(__file__).parent
        migrations_path = current_dir / ".." / ".." / ".." / "backend" / "migrations"
        migrations_path = migrations_path.resolve()

        if migrations_path.exists() and migrations_path.is_dir():
            return migrations_path

        raise FileNotFoundError(
            f"Hardcoded migrations directory not found: {migrations_path}"
        )

    def discover_migration_files(self) -> Dict[str, List[str]]:
        """
        Discover JSON vocabulary files in the migrations directory.

        Returns:
            Dictionary mapping language codes to lists of filenames
        """
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
                    lang_code = {"english": "en", "german": "de", "spanish": "es"}[
                        source_lang
                    ]
                    if lang_code not in discovered:
                        discovered[lang_code] = []
                    discovered[lang_code].append(filename)

        return discovered

    def parse_migration_file(self, filename: str) -> List[VocabularyEntry]:
        """
        Parse a single JSON vocabulary file and extract vocabulary entries.

        Args:
            filename: Name of the JSON file to parse

        Returns:
            List of vocabulary entries found in the file

        Raises:
            FileNotFoundError: If the migration file doesn't exist
            ValueError: If the file format is invalid
        """
        # Look for JSON file in vocabulary subdirectory
        file_path = self.migrations_dir / "data" / "vocabulary" / filename
        if not file_path.exists():
            file_path = self.migrations_dir / "data" / filename

        if not file_path.exists():
            raise FileNotFoundError(f"JSON vocabulary file not found: {file_path}")

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            raise ValueError(f"Error reading JSON file {filename}: {e}")

        return self._extract_entries_from_json(data, filename)

    def _extract_entries_from_json(
        self, data: dict, filename: str
    ) -> List[VocabularyEntry]:
        """
        Extract vocabulary entries from JSON vocabulary data.

        Args:
            data: JSON vocabulary data
            filename: Source filename (for error reporting)

        Returns:
            List of vocabulary entries
        """
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
                raise ValueError(
                    f"JSON file {filename} has malformed word_pair missing field: {e}"
                )

        return entries
