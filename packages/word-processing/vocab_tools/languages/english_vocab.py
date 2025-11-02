"""
English vocabulary analyzer for LinguaQuiz.

Specialized analyzer for English vocabulary that uses advanced NLP
to identify missing essential words and classify them appropriately.
"""

from pathlib import Path

from ..config.constants import get_pos_description
from ..core.vocabulary_analyzer import VocabularyAnalyzer


class EnglishVocabularyAnalyzer(VocabularyAnalyzer):
    """
    Analyzes English vocabulary gaps using NLP-driven classification.

    Uses spaCy models to perform sophisticated part-of-speech analysis
    and morphological understanding for accurate word categorization.
    """

    def __init__(self, migrations_directory: Path = None, silent: bool = False):
        """Initialize the English vocabulary analyzer."""
        super().__init__("en", migrations_directory, silent=silent)
        if not silent:
            print("🏴󠁧󠁢󠁥󠁮󠁧󠁿 Initializing English vocabulary analyzer...")

    def analyze_word_linguistics(self, word: str, existing_words: set[str], rank: int = None) -> tuple[str, str, str]:
        """
        Analyze English word using spaCy NLP for comprehensive classification.

        Args:
            word: English word to analyze
            existing_words: Set of existing vocabulary words

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        # Use base NLP processing (English doesn't need normalization)
        result = self._analyze_word_linguistics_base(word, existing_words, use_normalization=False)

        # If base method returned a complete result (proper_noun or inflected_form)
        if isinstance(result, tuple):
            return result

        # Extract intermediate data for English-specific processing
        pos_tag = result["pos_tag"]
        morphology = result["morphology"]

        # Categorize based on part of speech (using base class method)
        category = self._categorize_by_pos(pos_tag, word)
        reason = self._generate_analysis_reason(word, pos_tag, morphology, rank)

        return category, pos_tag, reason

    def _generate_analysis_reason(self, word: str, pos_tag: str, morphology: str, rank: int = None) -> str:
        """
        Generate human-readable analysis reason with frequency rank.

        Args:
            word: Original word
            pos_tag: Part-of-speech tag
            morphology: Morphological features
            rank: Frequency rank of the word (1-based)

        Returns:
            Analysis reason string
        """
        description = get_pos_description(pos_tag).capitalize()

        # Add specific morphological information
        if morphology:
            if "Number=Plur" in morphology and pos_tag == "NOUN":
                description = "Plural noun"
            elif "Degree=Cmp" in morphology and pos_tag == "ADJ":
                description = "Comparative adjective"
            elif "Degree=Sup" in morphology and pos_tag == "ADJ":
                description = "Superlative adjective"
            elif "Tense=Past" in morphology and pos_tag == "VERB":
                description = "Past tense verb"

        # Build enriched reason with rank information
        if rank:
            return f"Top {rank:,} word; classified as {description.lower()}"
        return f"High frequency {description.lower()}"
