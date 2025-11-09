import json
from dataclasses import dataclass
from pathlib import Path


@dataclass
class VocabularyEntry:
    source_word: str
    target_word: str
    source_example: str
    target_example: str

    def __post_init__(self):
        pass


class VocabularyFileParser:
    def __init__(self, migrations_directory: Path | None = None):
        self.migrations_dir = migrations_directory or self._find_migrations_directory()

    def _find_migrations_directory(self) -> Path:
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
        file_path = self.migrations_dir / "data" / "vocabulary" / filename

        if not file_path.exists():
            raise FileNotFoundError(f"JSON vocabulary file not found: {file_path}")

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            raise ValueError(f"Error reading JSON file {filename}: {e}") from e

        return self._extract_entries_from_json(data, filename)

    def _extract_entries_from_json(self, data: dict, filename: str) -> list[VocabularyEntry]:
        entries = []

        if "translations" not in data:
            raise ValueError(f"JSON file {filename} missing 'translations' field")

        for word_pair in data["translations"]:
            try:
                entry = VocabularyEntry(
                    source_word=word_pair["source_word"],
                    target_word=word_pair["target_word"],
                    source_example=word_pair.get("source_example", ""),
                    target_example=word_pair.get("target_example", ""),
                )
                entries.append(entry)
            except KeyError as e:
                raise ValueError(f"JSON file {filename} has malformed word_pair missing field: {e}") from e

        return entries
