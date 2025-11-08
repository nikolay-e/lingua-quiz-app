"""
German vocabulary analyzer for LinguaQuiz.

Specialized analyzer for German vocabulary with proper handling of
German linguistic features like articles, compound words, and inflections.
"""

from pathlib import Path

from ..config.constants import get_pos_description
from ..core.vocabulary_analyzer import VocabularyAnalyzer


class GermanVocabularyAnalyzer(VocabularyAnalyzer):
    """
    Analyzes German vocabulary gaps with German-specific linguistic handling.

    Handles German articles (der/die/das), compound words, and complex
    morphological inflections using spaCy German models.
    """

    def __init__(self, migrations_directory: Path = None, silent: bool = False):
        """Initialize the German vocabulary analyzer."""
        super().__init__("de", migrations_directory, silent=silent)

        from ..config.config_loader import get_config_loader

        config_loader = get_config_loader()
        lang_config = config_loader.get_language_config("de")
        self.german_articles = set(lang_config.get("normalization", {}).get("articles", []))

        if not silent:
            print("🇩🇪 Initializing German vocabulary analyzer...")

        # Note: Manual verb mapping removed - spaCy's lemmatization handles this better

    def analyze_word_linguistics(self, word: str, existing_words: set[str], rank: int = None) -> tuple[str, str, str]:
        """
        Analyze German word with specialized German linguistic processing.

        Args:
            word: German word to analyze
            existing_words: Set of existing vocabulary words

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        # Use base NLP processing with normalization for German
        result = self._analyze_word_linguistics_base(word, existing_words, use_normalization=True)

        # If base method returned a complete result (proper_noun or inflected_form)
        if isinstance(result, tuple):
            return result

        # Extract intermediate data for German-specific processing
        pos_tag = result["pos_tag"]
        morphology = result["morphology"]

        # Note: Compound word detection is handled by spaCy lemmatization
        # Custom compound detection is complex and unnecessary

        # Categorize based on POS and German-specific rules (using base class method)
        category = self._categorize_by_pos(pos_tag, word)
        reason = self._generate_german_reason(word, pos_tag, morphology)

        return category, pos_tag, reason

    def _pre_categorize_hook(self, word: str) -> str | None:
        """Check for German articles before POS categorization."""
        if word.lower() in self.german_articles:
            return "function_words"
        return None

    def _generate_german_reason(self, word: str, pos_tag: str, morphology: str) -> str:
        """
        Generate German-specific analysis reason.

        Args:
            word: Original word
            pos_tag: Part-of-speech tag
            morphology: Morphological features

        Returns:
            Analysis reason string
        """
        description = get_pos_description(pos_tag, language_prefix="German").capitalize()

        # Add morphological details for German
        if morphology and pos_tag == "NOUN":
            if "Gender=Masc" in morphology:
                description += " (masculine)"
            elif "Gender=Fem" in morphology:
                description += " (feminine)"
            elif "Gender=Neut" in morphology:
                description += " (neuter)"

        return f"{description} - high frequency German vocabulary"
