"""
German vocabulary analyzer for LinguaQuiz.

Specialized analyzer for German vocabulary with proper handling of
German linguistic features like articles, compound words, and inflections.
"""

from pathlib import Path
from typing import Set, Tuple

from ..config.constants import WORD_CATEGORY_MAPPING
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
        if not silent:
            print("🇩🇪 Initializing German vocabulary analyzer...")

        # German-specific configurations
        self.german_articles = {
            "der",
            "die",
            "das",
            "den",
            "dem",
            "des",
            "ein",
            "eine",
            "einer",
            "einen",
            "einem",
            "eines",
        }

        # Note: Manual verb mapping removed - spaCy's lemmatization handles this better

    def analyze_word_linguistics(
        self, word: str, existing_words: Set[str], rank: int = None
    ) -> Tuple[str, str, str]:
        """
        Analyze German word with specialized German linguistic processing.

        Args:
            word: German word to analyze
            existing_words: Set of existing vocabulary words

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        # Normalize word for German-specific processing
        normalized_word = word.lower()

        # Process with NLP model (handles verb inflections automatically)
        doc = self.nlp_model(word)
        if not doc or len(doc) == 0:
            return "other", "UNKNOWN", "NLP processing failed"

        token = doc[0]
        lemma = token.lemma_.lower()
        pos_tag = token.pos_
        morphology = str(token.morph) if hasattr(token, "morph") else ""

        # Filter out proper nouns (names, places, brands) - focus on core vocabulary
        if token.ent_type_ and token.ent_type_ not in ["ORDINAL", "CARDINAL"]:
            return (
                "proper_noun",
                token.ent_type_,
                f"Filtered out as named entity: {token.ent_type_}",
            )

        # Check for lemma in existing words (after German normalization)
        normalized_lemma = self.normalizer.normalize(lemma)
        if normalized_lemma != normalized_word and normalized_lemma in existing_words:
            reason = self._get_german_inflection_reason(
                word, lemma, morphology, pos_tag
            )
            return "inflected_forms", pos_tag, reason

        # Note: Compound word detection is handled by spaCy lemmatization
        # Custom compound detection is complex and unnecessary

        # Categorize based on POS and German-specific rules
        category = self._categorize_german_word(pos_tag, word, morphology)
        reason = self._generate_german_reason(word, pos_tag, morphology)

        return category, pos_tag, reason

    def _get_german_inflection_reason(
        self, word: str, lemma: str, morphology: str, pos_tag: str
    ) -> str:
        """
        Generate specific reason for German inflected forms.

        Args:
            word: Original word
            lemma: Base form
            morphology: Morphological features
            pos_tag: Part-of-speech tag

        Returns:
            Human-readable reason for the German inflection
        """
        if pos_tag == "VERB":
            if "Tense=Past" in morphology:
                return f"Past tense of '{lemma}'"
            elif "Number=Plur" in morphology:
                return f"Plural form of '{lemma}'"
            elif "Person=1" in morphology and "Number=Sing" in morphology:
                return f"First person singular of '{lemma}'"
            elif "Person=2" in morphology:
                return f"Second person form of '{lemma}'"
            elif "Person=3" in morphology:
                return f"Third person form of '{lemma}'"
            else:
                return f"Conjugated form of '{lemma}'"

        elif pos_tag == "NOUN":
            if "Number=Plur" in morphology:
                return f"Plural form of '{lemma}'"
            elif "Case=Dat" in morphology:
                return f"Dative form of '{lemma}'"
            elif "Case=Gen" in morphology:
                return f"Genitive form of '{lemma}'"
            elif "Case=Acc" in morphology:
                return f"Accusative form of '{lemma}'"
            else:
                return f"Inflected form of '{lemma}'"

        elif pos_tag == "ADJ":
            if "Degree=Cmp" in morphology:
                return f"Comparative form of '{lemma}'"
            elif "Degree=Sup" in morphology:
                return f"Superlative form of '{lemma}'"
            else:
                return f"Inflected adjective form of '{lemma}'"

        else:
            return f"Inflected form of '{lemma}'"

    def _categorize_german_word(self, pos_tag: str, word: str, morphology: str) -> str:
        """
        Categorize German word with German-specific rules.

        Args:
            pos_tag: Part-of-speech tag
            word: Original word
            morphology: Morphological features

        Returns:
            Category name
        """
        # Handle German-specific categories
        if word.lower() in self.german_articles:
            return "function_words"

        # Use standard POS mapping
        for category, pos_tags in WORD_CATEGORY_MAPPING.items():
            if pos_tag in pos_tags:
                return category

        return "other"

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
        pos_descriptions = {
            "NOUN": "German noun",
            "VERB": "German verb",
            "ADJ": "German adjective",
            "ADV": "German adverb",
            "DET": "German determiner/article",
            "PRON": "German pronoun",
            "ADP": "German preposition",
            "CONJ": "German conjunction",
            "NUM": "German number",
            "PART": "German particle",
            "AUX": "German auxiliary verb",
        }

        description = pos_descriptions.get(pos_tag, "German word")

        # Add morphological details for German
        if morphology and pos_tag == "NOUN":
            if "Gender=Masc" in morphology:
                description += " (masculine)"
            elif "Gender=Fem" in morphology:
                description += " (feminine)"
            elif "Gender=Neut" in morphology:
                description += " (neuter)"

        return f"{description} - high frequency German vocabulary"
