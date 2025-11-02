from abc import ABC, abstractmethod
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from wordfreq import top_n_list

from .database_parser import VocabularyFileParser


@dataclass
class Word:
    text: str
    source: str
    metadata: dict | None = None


class WordSource(ABC):
    @abstractmethod
    def get_words(self) -> Iterator[Word]:
        pass

    @abstractmethod
    def get_language_code(self) -> str:
        pass

    def count(self) -> int:
        return sum(1 for _ in self.get_words())


class MigrationFileSource(WordSource):
    def __init__(self, migrations_directory: Path | None, language_code: str):
        self.language_code = language_code
        self.parser = VocabularyFileParser(migrations_directory)
        self.files = self._discover_files()

    def _discover_files(self) -> list[str]:
        discovered = self.parser.discover_migration_files()
        return discovered.get(self.language_code, [])

    def get_words(self) -> Iterator[Word]:
        for filename in self.files:
            entries = self.parser.parse_migration_file(filename)
            for entry in entries:
                yield Word(
                    text=entry.source_word,
                    source=f"migration:{filename}",
                    metadata={
                        "translation_id": entry.translation_id,
                        "target_word": entry.target_word,
                        "source_example": entry.source_example,
                        "target_example": entry.target_example,
                    },
                )

    def get_language_code(self) -> str:
        return self.language_code


class FrequencySource(WordSource):
    def __init__(self, language_code: str, top_n: int = 8000, start_rank: int = 1):
        self.language_code = language_code
        self.top_n = top_n
        self.start_rank = start_rank
        self._words = None

    def _load_words(self):
        if self._words is None:
            all_words = top_n_list(self.language_code, self.start_rank + self.top_n - 1)
            self._words = all_words[self.start_rank - 1 :]

    def get_words(self) -> Iterator[Word]:
        self._load_words()
        for rank, word in enumerate(self._words, start=self.start_rank):
            yield Word(
                text=word,
                source=f"wordfreq:rank{rank}",
                metadata={"rank": rank, "source": "wordfreq"},
            )

    def get_language_code(self) -> str:
        return self.language_code


class CustomListSource(WordSource):
    def __init__(self, file_path: Path, language_code: str):
        self.file_path = file_path
        self.language_code = language_code
        self._words = None

    def _load_words(self):
        if self._words is None:
            with open(self.file_path, encoding="utf-8") as f:
                if self.file_path.suffix == ".json":
                    import json

                    data = json.load(f)
                    if isinstance(data, list):
                        self._words = data
                    elif isinstance(data, dict) and "words" in data:
                        self._words = data["words"]
                    else:
                        raise ValueError(f"Unsupported JSON structure in {self.file_path}")
                elif self.file_path.suffix == ".csv":
                    import csv

                    reader = csv.DictReader(f)
                    self._words = [row.get("word", row.get("text", next(iter(row.values())))) for row in reader]
                else:
                    self._words = [line.strip() for line in f if line.strip()]

    def get_words(self) -> Iterator[Word]:
        self._load_words()
        for idx, word in enumerate(self._words, start=1):
            if isinstance(word, dict):
                text = word.get("word", word.get("text", ""))
                metadata = {k: v for k, v in word.items() if k not in ["word", "text"]}
            else:
                text = str(word)
                metadata = {}

            yield Word(
                text=text,
                source=f"custom:{self.file_path.name}:line{idx}",
                metadata=metadata,
            )

    def get_language_code(self) -> str:
        return self.language_code
