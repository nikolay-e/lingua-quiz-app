"""
English vocabulary analyzer for LinguaQuiz.

Specialized analyzer for English vocabulary that uses advanced NLP
to identify missing essential words and classify them appropriately.
"""

from pathlib import Path
from typing import Set, Tuple

from ..config.constants import WORD_CATEGORY_MAPPING
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

    def analyze_word_linguistics(
        self, word: str, existing_words: Set[str], rank: int = None
    ) -> Tuple[str, str, str]:
        """
        Analyze English word using spaCy NLP for comprehensive classification.

        Args:
            word: English word to analyze
            existing_words: Set of existing vocabulary words

        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        # Process word with NLP model
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

        # Check if this is an inflected form of an existing word
        if lemma != word.lower() and lemma in existing_words:
            reason = self._get_inflection_reason(morphology, lemma)
            return "inflected_forms", pos_tag, reason

        # Categorize based on part of speech
        category = self._categorize_by_pos(pos_tag)
        reason = self._generate_analysis_reason(word, pos_tag, morphology, rank)

        return category, pos_tag, reason

    def _get_inflection_reason(self, morphology: str, lemma: str) -> str:
        """
        Generate specific reason for inflected forms.

        Args:
            morphology: Morphological features string
            lemma: Base form of the word

        Returns:
            Human-readable reason for the inflection
        """
        if "Tense=Past" in morphology:
            return f"Past tense of '{lemma}'"
        elif "Number=Plur" in morphology:
            return f"Plural form of '{lemma}'"
        elif "Degree=Cmp" in morphology:
            return f"Comparative form of '{lemma}'"
        elif "Degree=Sup" in morphology:
            return f"Superlative form of '{lemma}'"
        elif "VerbForm=Ger" in morphology:
            return f"Gerund form of '{lemma}'"
        elif "VerbForm=Part" in morphology:
            return f"Participle form of '{lemma}'"
        else:
            return f"Inflected form of '{lemma}'"

    def _categorize_by_pos(self, pos_tag: str) -> str:
        """
        Categorize word based on part-of-speech tag.

        Args:
            pos_tag: spaCy POS tag

        Returns:
            Category name for the word
        """
        # Map POS tags to categories using configuration
        for category, pos_tags in WORD_CATEGORY_MAPPING.items():
            if pos_tag in pos_tags:
                return category

        return "other"

    def _generate_analysis_reason(
        self, word: str, pos_tag: str, morphology: str, rank: int = None
    ) -> str:
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
        pos_descriptions = {
            "NOUN": "Common noun",
            "PROPN": "Proper noun",
            "VERB": "Verb",
            "ADJ": "Adjective",
            "ADV": "Adverb",
            "DET": "Determiner",
            "PRON": "Pronoun",
            "ADP": "Preposition",
            "CONJ": "Conjunction",
            "SCONJ": "Subordinating conjunction",
            "NUM": "Number",
            "PART": "Particle",
            "INTJ": "Interjection",
            "AUX": "Auxiliary verb",
        }

        description = pos_descriptions.get(pos_tag, "Unknown word type")

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
        else:
            return f"High frequency {description.lower()}"
