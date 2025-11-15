import csv
from pathlib import Path

from ..config.constants import BATCH_PROGRESS_INTERVAL_LARGE, LEMMATIZATION_BATCH_SIZE, RANK_NOT_FOUND
from .lemmatization_service import get_lemmatization_service


class SubtitleFrequencyIndex:
    """
    Fast lookup index for subtitle word frequencies with lemmatization.

    Builds lemma → rank index for proper language learning (infinitives, singular forms).
    """

    def __init__(self, language_code: str):
        self.language_code = language_code
        self._data_dir = Path(__file__).parent.parent / "data" / "subtitle_frequencies"
        self._lemma_to_rank = None
        self._lemmatization_service = get_lemmatization_service(language_code)
        self._total_words = 0

    def _load_from_csv(self, csv_file: Path):
        """Load pre-lemmatized CSV file (instant, no NLP needed)."""
        self._lemma_to_rank = {}

        with open(csv_file, encoding="utf-8") as f:
            reader = csv.DictReader(f)

            for rank, row in enumerate(reader, start=1):
                lemma = row["lemma"].lower()

                if lemma not in self._lemma_to_rank:
                    self._lemma_to_rank[lemma] = rank
                else:
                    self._lemma_to_rank[lemma] = min(self._lemma_to_rank[lemma], rank)

        self._total_words = len(self._lemma_to_rank)

    def _load_index(self):
        """Load and lemmatize subtitle frequency list."""
        if self._lemma_to_rank is not None:
            return

        csv_file = self._data_dir / f"{self.language_code}_50k_lemmatized.csv"
        freq_file = self._data_dir / f"{self.language_code}_50k.txt"

        if not freq_file.exists():
            raise FileNotFoundError(
                f"Subtitle frequency file not found: {freq_file}\nDownload from: https://github.com/hermitdave/FrequencyWords"
            )

        # Fast path: use pre-lemmatized CSV if available
        if csv_file.exists():
            print(f"⚡ Loading pre-lemmatized subtitle index for {self.language_code}...")
            self._load_from_csv(csv_file)
            print(f"Loaded {self._total_words} lemmas from CSV (instant)")
            return

        # Slow path: lemmatize on the fly using centralized service
        print(f" Building lemmatized subtitle index for {self.language_code}...")
        print("   (This is slow. Run: python -m vocab_tools.scripts.generate_lemmatized_frequencies)")

        self._lemma_to_rank = {}
        word_forms = []

        with open(freq_file, encoding="utf-8") as f:
            for rank, line in enumerate(f, start=1):
                parts = line.strip().split()
                if len(parts) >= 2:
                    word = parts[0].lower()
                    word_forms.append((word, rank))

        # Use LemmatizationService for batch processing
        batch_size = LEMMATIZATION_BATCH_SIZE
        for batch_start in range(0, len(word_forms), batch_size):
            batch = word_forms[batch_start : batch_start + batch_size]
            words = [w for w, r in batch]

            # Batch lemmatize
            lemmas = self._lemmatization_service.lemmatize_batch(words)

            for idx, lemma in enumerate(lemmas):
                word, rank = batch[idx]

                if lemma not in self._lemma_to_rank:
                    self._lemma_to_rank[lemma] = rank
                else:
                    self._lemma_to_rank[lemma] = min(self._lemma_to_rank[lemma], rank)

            if (batch_start + batch_size) % BATCH_PROGRESS_INTERVAL_LARGE == 0:
                print(f"   Processed {batch_start + batch_size}/{len(word_forms)} words...")

        self._total_words = len(self._lemma_to_rank)
        print(f"Indexed {self._total_words} lemmas from subtitles")

    def get_rank(self, word: str) -> int:
        """
        Get subtitle frequency rank for word's lemma (1 = most frequent).

        Always lemmatizes the query word before lookup.
        Returns RANK_NOT_FOUND if lemma not found in top 50k.
        """
        self._load_index()

        lemma = self._lemmatization_service.lemmatize(word)
        return self._lemma_to_rank.get(lemma, RANK_NOT_FOUND)

    def get_lemma(self, word: str) -> str:
        """
        Get lemma for a word using centralized lemmatization service.

        Returns the lemmatized form of the word.
        """
        return self._lemmatization_service.lemmatize(word)

    def get_zipf(self, word: str) -> float:
        """
        Get Zipf frequency score (0-8 scale, higher = more frequent).

        Converts rank to Zipf score compatible with wordfreq.
        Formula: zipf = 8 - log10(rank)

        Examples:
        - Rank 1 → 8.0
        - Rank 10 → 7.0
        - Rank 100 → 6.0
        - Rank 1000 → 5.0
        - Rank 10000 → 4.0
        """
        import math

        rank = self.get_rank(word)

        if rank == RANK_NOT_FOUND:
            return 0.0

        return 8.0 - math.log10(rank)

    def word_frequency(self, word: str) -> float:
        """
        Get word frequency (0-1 scale, compatible with wordfreq).

        Approximation based on Zipf score.
        """
        zipf = self.get_zipf(word)

        if zipf == 0:
            return 0.0

        return 10 ** (zipf - 8)


_SUBTITLE_INDEXES = {}


def get_subtitle_frequency_index(language_code: str) -> SubtitleFrequencyIndex:
    """Get or create subtitle frequency index for language (cached)."""
    if language_code not in _SUBTITLE_INDEXES:
        _SUBTITLE_INDEXES[language_code] = SubtitleFrequencyIndex(language_code)
    return _SUBTITLE_INDEXES[language_code]
