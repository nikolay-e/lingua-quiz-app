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
                        "target_word": entry.target_word,
                        "source_example": entry.source_example,
                        "target_example": entry.target_example,
                    },
                )

    def get_language_code(self) -> str:
        return self.language_code


class FrequencyBasedSource(WordSource):
    """Base class for frequency-based word sources with common lemmatization logic."""

    def __init__(self, language_code: str, top_n: int = 8000, start_rank: int = 1, lemmatize: bool = False):
        self.language_code = language_code
        self.top_n = top_n
        self.start_rank = start_rank
        self.lemmatize = lemmatize
        self._words = None
        self._lemmatization_service = None

    def _get_lemmatization_service(self):
        if self._lemmatization_service is None and self.lemmatize:
            from .lemmatization_service import get_lemmatization_service

            self._lemmatization_service = get_lemmatization_service(self.language_code)
        return self._lemmatization_service

    def _filter_junk_words(self, words: list[str]) -> list[str]:
        """
        Filter out junk words (numbers, proper nouns, blacklisted words, etc.).

        Args:
            words: List of words to filter

        Returns:
            Filtered list without junk
        """
        if not self.lemmatize:
            return words

        from ..config.config_loader import get_config_loader
        from .nlp_models import get_nlp_model

        config_loader = get_config_loader()
        lang_config = config_loader.get_language_config(self.language_code)
        blacklist = lang_config.get("blacklist", {})

        # Build set of all blacklisted words
        blacklisted_words = set()
        for _, word_list in blacklist.items():
            blacklisted_words.update(w.lower() for w in word_list)

        model_preferences = config_loader.get_spacy_models(self.language_code)
        nlp = get_nlp_model(self.language_code, model_preferences, silent=True)

        if nlp is None:
            return words

        filtered = []
        for word in words:
            word_lower = word.lower()

            # Skip pure numbers
            if word.isdigit():
                continue

            # Skip single letters (except important ones)
            if len(word) == 1 and word_lower not in ["y", "a", "o", "e", "i"]:
                continue

            # Skip blacklisted words
            if word_lower in blacklisted_words:
                continue

            # Check POS tag
            try:
                doc = nlp(word)
                if doc and len(doc) > 0:
                    token = doc[0]
                    # Skip proper nouns (names, places, etc.)
                    if token.pos_ == "PROPN":
                        continue
                    # Skip words with suspicious lemmatization (lemma too different from word)
                    lemma = token.lemma_.lower()
                    lemma_exceptions = lang_config.get("lemmatization_exceptions", {}).get("short_lemmas", [])
                    if len(word) > 3 and len(lemma) <= 3 and lemma not in lemma_exceptions:
                        # Lemma is suspiciously short, likely an error
                        continue
                filtered.append(word)
            except Exception:
                # If analysis fails, keep the word
                filtered.append(word)

        return filtered

    def _deduplicate_lemmas(self, lemmas: list[str]) -> list[str]:
        """Deduplicate lemmas while preserving order (first occurrence)."""
        seen = set()
        deduplicated = []
        for lemma in lemmas:
            if lemma not in seen:
                seen.add(lemma)
                deduplicated.append(lemma)
        return deduplicated

    @abstractmethod
    def _fetch_raw_words(self) -> list[str]:
        """Fetch raw words from the source (to be implemented by subclasses)."""
        pass

    @abstractmethod
    def _get_source_prefix(self) -> str:
        """Get source prefix for Word.source field (to be implemented by subclasses)."""
        pass

    @abstractmethod
    def _get_metadata_source(self) -> str:
        """Get source value for metadata (to be implemented by subclasses)."""
        pass

    def _load_words(self):
        """Template method for loading and processing words."""
        if self._words is None:
            words_slice = self._fetch_raw_words()

            # Filter junk before lemmatization
            if self.lemmatize:
                words_slice = self._filter_junk_words(words_slice)

            if self.lemmatize:
                service = self._get_lemmatization_service()
                lemmas = service.lemmatize_batch(words_slice)
                self._words = self._deduplicate_lemmas(lemmas)
            else:
                self._words = words_slice

    def get_words(self) -> Iterator[Word]:
        """Template method for yielding words."""
        self._load_words()
        source_prefix = self._get_source_prefix()
        metadata_source = self._get_metadata_source()
        for rank, word in enumerate(self._words, start=self.start_rank):
            yield Word(
                text=word,
                source=f"{source_prefix}:rank{rank}",
                metadata={"rank": rank, "source": metadata_source},
            )

    def get_language_code(self) -> str:
        return self.language_code


class FrequencySource(FrequencyBasedSource):
    """Word source from wordfreq library."""

    def _fetch_raw_words(self) -> list[str]:
        all_words = top_n_list(self.language_code, self.start_rank + self.top_n - 1)
        return all_words[self.start_rank - 1 :]

    def _get_source_prefix(self) -> str:
        return "wordfreq"

    def _get_metadata_source(self) -> str:
        return "wordfreq"


class SubtitleFrequencySource(FrequencyBasedSource):
    """Word source from subtitle frequency files."""

    def __init__(self, language_code: str, top_n: int = 8000, start_rank: int = 1, lemmatize: bool = False):
        super().__init__(language_code, top_n, start_rank, lemmatize)
        self._data_dir = Path(__file__).parent.parent / "data" / "subtitle_frequencies"

    def _fetch_raw_words(self) -> list[str]:
        freq_file = self._data_dir / f"{self.language_code}_50k.txt"

        if not freq_file.exists():
            raise FileNotFoundError(
                f"Subtitle frequency file not found: {freq_file}\nDownload from: https://github.com/hermitdave/FrequencyWords"
            )

        words_with_freq = []
        with open(freq_file, encoding="utf-8") as f:
            for line in f:
                parts = line.strip().split()
                if len(parts) >= 2:
                    word = parts[0]
                    words_with_freq.append(word)

        return words_with_freq[self.start_rank - 1 : self.start_rank + self.top_n - 1]

    def _get_source_prefix(self) -> str:
        return "subtitles"

    def _get_metadata_source(self) -> str:
        return "opensubtitles"


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
