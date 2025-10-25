"""
Base vocabulary analyzer for language learning applications.

Provides the foundation for analyzing vocabulary gaps and recommending
new words based on frequency analysis and NLP classification.
"""

from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from wordfreq import top_n_list, word_frequency

from ..config.constants import (
    ANALYSIS_SKIP_WORDS,
    DEFAULT_ANALYSIS_CONFIG,
    ESSENTIAL_VOCABULARY_CATEGORIES,
    SUPPORTED_LANGUAGES,
)
from .database_parser import VocabularyEntry, VocabularyFileParser
from .word_normalizer import get_normalizer


@dataclass
class WordAnalysis:
    """Results of analyzing a single word."""

    word: str
    frequency: float
    category: str
    pos_tag: str
    reason: str
    is_recommended: bool = False


@dataclass
class VocabularyAnalysisResult:
    """Complete results of vocabulary analysis."""

    language_code: str
    total_existing_words: int
    total_analyzed_words: int
    recommendations: list[WordAnalysis]
    categories: dict[str, list[WordAnalysis]]

    def get_recommendation_count(self) -> int:
        """Get the number of recommended words."""
        return len(self.recommendations)

    def get_category_summary(self) -> dict[str, int]:
        """Get word counts by category."""
        return {category: len(words) for category, words in self.categories.items()}

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "language_code": self.language_code,
            "total_existing_words": self.total_existing_words,
            "total_analyzed_words": self.total_analyzed_words,
            "recommendation_count": self.get_recommendation_count(),
            "category_summary": self.get_category_summary(),
            "recommendations": [
                {
                    "word": r.word,
                    "frequency": r.frequency,
                    "category": r.category,
                    "pos_tag": r.pos_tag,
                    "reason": r.reason,
                }
                for r in self.recommendations
            ],
        }


class VocabularyAnalyzer(ABC):
    """
    Base class for language-specific vocabulary analyzers.

    Provides common functionality for analyzing vocabulary gaps
    and generating learning recommendations.
    """

    def __init__(
        self,
        language_code: str,
        migrations_directory: Path | None = None,
        config: dict[str, Any] | None = None,
        silent: bool = False,
    ):
        """
        Initialize the vocabulary analyzer.

        Args:
            language_code: ISO language code (en, de, es)
            migrations_directory: Path to migrations directory
            config: Analysis configuration parameters
        """
        self.language_code = language_code
        self.config = {**DEFAULT_ANALYSIS_CONFIG, **(config or {})}
        self.silent = silent

        # Initialize components
        self.db_parser = VocabularyFileParser(migrations_directory)
        self.normalizer = get_normalizer(language_code)
        self._nlp_model: Any | None = None

        # Supported languages
        if language_code not in SUPPORTED_LANGUAGES:
            raise ValueError(f"Unsupported language: {language_code}")

    @property
    def nlp_model(self) -> Any:
        """Lazy-load the NLP model."""
        if self._nlp_model is None:
            self._nlp_model = self.load_nlp_model(silent=self.silent)
        return self._nlp_model

    def load_nlp_model(self, silent: bool = False) -> Any:
        """
        Load the appropriate NLP model for this language.

        Args:
            silent: If True, suppress loading messages

        Returns:
            Loaded spaCy NLP model
        """
        from ..config.constants import NLP_MODEL_PREFERENCES
        from .nlp_models import get_nlp_model

        model_preferences = NLP_MODEL_PREFERENCES.get(self.language_code, [])
        return get_nlp_model(self.language_code, model_preferences, silent=silent)

    @abstractmethod
    def analyze_word_linguistics(self, word: str, existing_words: set[str], rank: int = None) -> tuple[str, str, str]:
        """
        Perform language-specific linguistic analysis of a word.

        Args:
            word: Word to analyze
            existing_words: Set of existing vocabulary words
            rank: Frequency rank of the word (1-based)

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """

    def extract_existing_vocabulary(self) -> set[str]:
        discovered_files = self.db_parser.discover_migration_files()
        language_files = discovered_files.get(self.language_code, [])

        if not language_files:
            print(f"⚠️ No migration file found for language '{self.language_code}'")
            return set()

        existing_words = set()
        for migration_file in language_files:
            try:
                entries = self.db_parser.parse_migration_file(migration_file)
                for entry in entries:
                    if self._is_valid_vocabulary_entry(entry):
                        word_variants = self.normalizer.extract_word_variants(entry.source_word)
                        existing_words.update(word_variants)
            except FileNotFoundError:
                print(f"⚠️ Migration file not found: {migration_file}")
                continue

        return existing_words

    def _is_valid_vocabulary_entry(self, entry: VocabularyEntry) -> bool:
        """
        Check if a vocabulary entry is valid for analysis.

        Args:
            entry: Vocabulary entry to validate

        Returns:
            True if entry is valid for analysis
        """
        # Skip obvious placeholder entries
        if entry.source_word == "word" and entry.target_word == "translation":
            return False

        # Skip empty entries
        if not entry.source_word.strip():
            return False

        return True

    def get_frequent_missing_words(
        self,
        top_n: int = 1000,
        start_rank: int = 1,
        existing_words: set[str] | None = None,
    ) -> list[tuple[str, int]]:
        """
        Get most frequent words that are missing from vocabulary within a frequency range.

        Args:
            top_n: Number of top frequent words to consider (end of range)
            start_rank: Starting rank for frequency range (1-based, default: 1)
            existing_words: Pre-loaded existing words set (if None, will extract)

        Returns:
            List of (word, original_rank) tuples sorted by frequency within the specified range
        """
        if existing_words is None:
            existing_words = self.extract_existing_vocabulary()

        # Get top frequent words for this language
        all_frequent_words = top_n_list(self.language_code, top_n)

        # Extract words within the specified frequency range
        # Convert to 0-based indexing for slicing
        start_idx = start_rank - 1
        frequent_words = all_frequent_words[start_idx:]

        # Filter to valid words not in existing vocabulary, preserving original ranks
        missing_words = []
        for i, word in enumerate(frequent_words):
            if self._is_word_valid_for_analysis(word) and self.normalizer.normalize(word) not in existing_words:
                original_rank = start_rank + i  # Calculate original rank
                missing_words.append((word, original_rank))

        return missing_words

    def _is_word_valid_for_analysis(self, word: str) -> bool:
        """
        Check if a word is valid for analysis.

        Args:
            word: Word to validate

        Returns:
            True if word should be analyzed
        """
        if not word or len(word) < self.config["min_word_length"]:
            return False

        if len(word) > self.config["max_word_length"]:
            return False

        if word.isdigit():
            return False

        # Check against skip words
        normalized_word = self.normalizer.normalize(word)
        if normalized_word in ANALYSIS_SKIP_WORDS:
            return False

        # Check frequency threshold
        freq = word_frequency(word, self.language_code)
        if freq < self.config["frequency_threshold"]:
            return False

        return True

    def analyze_vocabulary_gaps(
        self,
        top_n: int = 1000,
        start_rank: int = 1,
        limit_analysis: int | None = None,
        show_progress: bool = True,
    ) -> VocabularyAnalysisResult:
        """
        Analyze vocabulary gaps and generate recommendations.

        Args:
            top_n: Number of top frequent words to analyze (end of range)
            start_rank: Starting rank for frequency analysis (1-based)
            limit_analysis: Limit analysis to first N missing words
            show_progress: Whether to show progress information

        Returns:
            Complete analysis results
        """
        if show_progress:
            print(f"🔍 Analyzing {self.language_code.upper()} vocabulary gaps...")

        # Extract existing vocabulary
        existing_words = self.extract_existing_vocabulary()
        if show_progress:
            print(f"📊 Found {len(existing_words)} existing words")

        # Get missing words to analyze within the specified frequency range
        missing_words = self.get_frequent_missing_words(top_n, start_rank, existing_words)
        if limit_analysis and limit_analysis < len(missing_words):
            missing_words = missing_words[:limit_analysis]
            if show_progress:
                print(f"⚠️  Limited analysis to first {limit_analysis} words")

        if show_progress:
            print(f"🎯 Analyzing {len(missing_words)} missing words...")

        # Analyze each missing word with lemma prioritization
        categories = defaultdict(list)
        all_analyses = []
        analyzed_lemmas = set()  # Track lemmas we've already processed

        for word, original_rank in missing_words:
            try:
                # Get lemma for this word
                doc = self.nlp_model(word)
                if not doc or len(doc) == 0:
                    continue

                token = doc[0]
                lemma = token.lemma_.lower()

                # Skip if we've already processed this lemma
                if lemma in analyzed_lemmas:
                    continue

                # Check if the LEMMA is in the database
                normalized_lemma = self.normalizer.normalize(lemma)
                if normalized_lemma in existing_words:
                    continue

                # Analyze the lemma if it's valid
                if not self._is_word_valid_for_analysis(lemma):
                    continue

                category, pos_tag, reason = self.analyze_word_linguistics(lemma, existing_words, rank=original_rank)
                frequency = word_frequency(lemma, self.language_code)

                analysis = WordAnalysis(
                    word=lemma,  # Use lemma instead of original word
                    frequency=frequency,
                    category=category,
                    pos_tag=pos_tag,
                    reason=reason,
                    is_recommended=(category in ESSENTIAL_VOCABULARY_CATEGORIES),
                )

                categories[category].append(analysis)
                all_analyses.append(analysis)
                analyzed_lemmas.add(lemma)  # Mark as processed

            except Exception as e:
                if show_progress:
                    print(f"⚠️  Error analyzing '{word}': {e}")
                continue

        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x.frequency, reverse=True)

        # Generate recommendations (essential categories only)
        recommendations = []
        for category in ESSENTIAL_VOCABULARY_CATEGORIES:
            if category in categories:
                recommendations.extend(categories[category])

        recommendations.sort(key=lambda x: x.frequency, reverse=True)

        return VocabularyAnalysisResult(
            language_code=self.language_code,
            total_existing_words=len(existing_words),
            total_analyzed_words=len(all_analyses),
            recommendations=recommendations,
            categories=dict(categories),
        )

    def print_analysis_results(self, result: VocabularyAnalysisResult, show_details: bool = True):
        """
        Print formatted analysis results.

        Args:
            result: Analysis results to print
            show_details: Whether to show detailed category breakdown
        """
        print(f"\n{'=' * 80}")
        print(f"📊 {result.language_code.upper()} VOCABULARY ANALYSIS RESULTS")
        print(f"{'=' * 80}")

        print("📈 Summary:")
        print(f"   • Existing vocabulary: {result.total_existing_words:,} words")
        print(f"   • Words analyzed: {result.total_analyzed_words:,} words")
        print(f"   • Recommendations: {result.get_recommendation_count():,} words")

        if show_details and result.categories:
            print("\n📋 Category Breakdown:")
            category_summary = result.get_category_summary()
            for category, count in category_summary.items():
                print(f"   • {category}: {count:,} words")

        if result.recommendations:
            print("\n🎯 Top Recommendations (by frequency):")
            for i, analysis in enumerate(result.recommendations[:20], 1):
                print(f"   {i:2d}. {analysis.word:<15} ({analysis.frequency:.2e}) - {analysis.reason}")

        print(f"\n{'=' * 80}")
