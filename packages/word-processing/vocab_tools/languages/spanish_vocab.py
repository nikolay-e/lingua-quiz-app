"""
Spanish vocabulary analyzer for LinguaQuiz.

Specialized analyzer for Spanish vocabulary with proper handling of
Spanish linguistic features like verb conjugations, gender, and accents.
"""

from pathlib import Path

from ..config.constants import get_pos_description
from ..core.vocabulary_analyzer import VocabularyAnalyzer


class SpanishVocabularyAnalyzer(VocabularyAnalyzer):
    """
    Analyzes Spanish vocabulary gaps with Spanish-specific linguistic handling.

    Handles Spanish verb conjugations, gender agreement, accent marks,
    and morphological variations using spaCy Spanish models.
    """

    def __init__(self, migrations_directory: Path = None, silent: bool = False):
        """Initialize the Spanish vocabulary analyzer."""
        super().__init__("es", migrations_directory, silent=silent)

        from ..config.config_loader import get_config_loader

        config_loader = get_config_loader()
        lang_config = config_loader.get_language_config("es")
        self.spanish_articles = set(lang_config.get("normalization", {}).get("articles", []))

        if not silent:
            print("🇪🇸 Initializing Spanish vocabulary analyzer...")

        # Note: Manual irregular verb mapping removed - spaCy's lemmatization handles this better

        # Note: Regular verb pattern mapping removed - spaCy's lemmatization handles this better

    def analyze_word_linguistics(self, word: str, existing_words: set[str], rank: int = None) -> tuple[str, str, str]:
        """
        Analyze Spanish word with specialized Spanish linguistic processing.

        Args:
            word: Spanish word to analyze
            existing_words: Set of existing vocabulary words

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        # Use base NLP processing with normalization for Spanish
        result = self._analyze_word_linguistics_base(word, existing_words, use_normalization=True)

        # If base method returned a complete result (proper_noun or inflected_form)
        if isinstance(result, tuple):
            return result

        # Extract intermediate data for Spanish-specific processing
        pos_tag = result["pos_tag"]
        morphology = result["morphology"]

        # Categorize based on POS and Spanish-specific rules (using base class method)
        category = self._categorize_by_pos(pos_tag, word)
        reason = self._generate_spanish_reason(word, pos_tag, morphology)

        return category, pos_tag, reason

    def _pre_categorize_hook(self, word: str) -> str | None:
        """Check for Spanish articles before POS categorization."""
        if word.lower() in self.spanish_articles:
            return "function_words"
        return None

    def _generate_spanish_reason(self, word: str, pos_tag: str, morphology: str) -> str:
        """
        Generate Spanish-specific analysis reason.

        Args:
            word: Original word
            pos_tag: Part-of-speech tag
            morphology: Morphological features

        Returns:
            Analysis reason string
        """
        description = get_pos_description(pos_tag, language_prefix="Spanish").capitalize()

        # Add morphological details for Spanish
        if morphology and pos_tag in ["NOUN", "ADJ"]:
            if "Gender=Masc" in morphology and "Number=Sing" in morphology:
                description += " (masculine singular)"
            elif "Gender=Fem" in morphology and "Number=Sing" in morphology:
                description += " (feminine singular)"
            elif "Gender=Masc" in morphology and "Number=Plur" in morphology:
                description += " (masculine plural)"
            elif "Gender=Fem" in morphology and "Number=Plur" in morphology:
                description += " (feminine plural)"

        return f"{description} - high frequency Spanish vocabulary"
