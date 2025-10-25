"""
Spanish vocabulary analyzer for LinguaQuiz.

Specialized analyzer for Spanish vocabulary with proper handling of
Spanish linguistic features like verb conjugations, gender, and accents.
"""

from pathlib import Path

from ..config.constants import WORD_CATEGORY_MAPPING
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
        if not silent:
            print("🇪🇸 Initializing Spanish vocabulary analyzer...")

        # Spanish-specific configurations
        self.spanish_articles = {"el", "la", "los", "las", "un", "una", "unos", "unas"}

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
        # Normalize word for Spanish-specific processing
        normalized_word = self.normalizer.normalize(word)

        # Note: Irregular verb handling removed - spaCy handles this better

        # Note: Regular verb conjugation checking removed - spaCy handles this better

        # Process with NLP model
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

        # Check for lemma in existing words
        normalized_lemma = self.normalizer.normalize(lemma)
        if normalized_lemma != normalized_word and normalized_lemma in existing_words:
            reason = self._get_spanish_inflection_reason(word, lemma, morphology, pos_tag)
            return "inflected_forms", pos_tag, reason

        # Categorize based on POS and Spanish-specific rules
        category = self._categorize_spanish_word(pos_tag, word, morphology)
        reason = self._generate_spanish_reason(word, pos_tag, morphology)

        return category, pos_tag, reason

    def _get_spanish_inflection_reason(self, word: str, lemma: str, morphology: str, pos_tag: str) -> str:
        """
        Generate specific reason for Spanish inflected forms.

        Args:
            word: Original word
            lemma: Base form
            morphology: Morphological features
            pos_tag: Part-of-speech tag

        Returns:
            Human-readable reason for the Spanish inflection
        """
        if pos_tag == "VERB":
            if "Tense=Past" in morphology:
                return f"Past tense of '{lemma}'"
            if "Tense=Pres" in morphology and "Person=1" in morphology:
                return f"First person present of '{lemma}'"
            if "Tense=Pres" in morphology and "Person=2" in morphology:
                return f"Second person present of '{lemma}'"
            if "Tense=Pres" in morphology and "Person=3" in morphology:
                return f"Third person present of '{lemma}'"
            if "Tense=Imp" in morphology:
                return f"Imperfect tense of '{lemma}'"
            if "Tense=Fut" in morphology:
                return f"Future tense of '{lemma}'"
            if "Mood=Sub" in morphology:
                return f"Subjunctive form of '{lemma}'"
            return f"Conjugated form of '{lemma}'"

        if pos_tag == "NOUN":
            if "Number=Plur" in morphology:
                return f"Plural form of '{lemma}'"
            if "Gender=Masc" in morphology and word.endswith("o"):
                return f"Masculine form of '{lemma}'"
            if "Gender=Fem" in morphology and word.endswith("a"):
                return f"Feminine form of '{lemma}'"
            return f"Inflected form of '{lemma}'"

        if pos_tag == "ADJ":
            if "Degree=Cmp" in morphology:
                return f"Comparative form of '{lemma}'"
            if "Degree=Sup" in morphology:
                return f"Superlative form of '{lemma}'"
            if "Number=Plur" in morphology and "Gender=Masc" in morphology:
                return f"Masculine plural form of '{lemma}'"
            if "Number=Plur" in morphology and "Gender=Fem" in morphology:
                return f"Feminine plural form of '{lemma}'"
            if "Gender=Fem" in morphology:
                return f"Feminine form of '{lemma}'"
            return f"Inflected adjective form of '{lemma}'"

        return f"Inflected form of '{lemma}'"

    def _categorize_spanish_word(self, pos_tag: str, word: str, morphology: str) -> str:
        """
        Categorize Spanish word with Spanish-specific rules.

        Args:
            pos_tag: Part-of-speech tag
            word: Original word
            morphology: Morphological features

        Returns:
            Category name
        """
        # Handle Spanish articles
        if word.lower() in self.spanish_articles:
            return "function_words"

        # Use standard POS mapping
        for category, pos_tags in WORD_CATEGORY_MAPPING.items():
            if pos_tag in pos_tags:
                return category

        return "other"

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
        pos_descriptions = {
            "NOUN": "Spanish noun",
            "VERB": "Spanish verb",
            "ADJ": "Spanish adjective",
            "ADV": "Spanish adverb",
            "DET": "Spanish determiner/article",
            "PRON": "Spanish pronoun",
            "ADP": "Spanish preposition",
            "CONJ": "Spanish conjunction",
            "NUM": "Spanish number",
            "PART": "Spanish particle",
            "AUX": "Spanish auxiliary verb",
        }

        description = pos_descriptions.get(pos_tag, "Spanish word")

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
