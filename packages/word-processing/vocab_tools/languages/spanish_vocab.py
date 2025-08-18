"""
Spanish vocabulary analyzer for LinguaQuiz.

Specialized analyzer for Spanish vocabulary with proper handling of
Spanish linguistic features like verb conjugations, gender, and accents.
"""

from pathlib import Path
from typing import Any, Set, Tuple

from ..config.constants import NLP_MODEL_PREFERENCES, WORD_CATEGORY_MAPPING
from ..core.nlp_models import get_nlp_model
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

        # Common Spanish irregular verb mappings
        self.irregular_verb_map = {
            # ser (to be)
            "soy": "ser",
            "eres": "ser",
            "es": "ser",
            "somos": "ser",
            "son": "ser",
            "era": "ser",
            "eras": "ser",
            "éramos": "ser",
            "eran": "ser",
            "fui": "ser",
            "fuiste": "ser",
            "fue": "ser",
            "fuimos": "ser",
            "fueron": "ser",
            # estar (to be - location/temporary state)
            "estoy": "estar",
            "estás": "estar",
            "está": "estar",
            "estamos": "estar",
            "están": "estar",
            "estaba": "estar",
            "estabas": "estar",
            "estábamos": "estar",
            "estaban": "estar",
            "estuve": "estar",
            "estuviste": "estar",
            "estuvo": "estar",
            "estuvimos": "estar",
            "estuvieron": "estar",
            # haber (to have - auxiliary)
            "he": "haber",
            "has": "haber",
            "ha": "haber",
            "hemos": "haber",
            "han": "haber",
            "había": "haber",
            "habías": "haber",
            "habíamos": "haber",
            "habían": "haber",
            # tener (to have)
            "tengo": "tener",
            "tienes": "tener",
            "tiene": "tener",
            "tenemos": "tener",
            "tienen": "tener",
            "tenía": "tener",
            "tenías": "tener",
            "teníamos": "tener",
            "tenían": "tener",
            "tuve": "tener",
            "tuviste": "tener",
            "tuvo": "tener",
            "tuvimos": "tener",
            "tuvieron": "tener",
            # hacer (to do/make)
            "hago": "hacer",
            "haces": "hacer",
            "hace": "hacer",
            "hacemos": "hacer",
            "hacen": "hacer",
            "hacía": "hacer",
            "hacías": "hacer",
            "hacíamos": "hacer",
            "hacían": "hacer",
            "hice": "hacer",
            "hiciste": "hacer",
            "hizo": "hacer",
            "hicimos": "hacer",
            "hicieron": "hacer",
        }

        # Spanish verb endings for regular verbs
        self.regular_verb_patterns = {
            "ar": [
                "o",
                "as",
                "a",
                "amos",
                "áis",
                "an",
                "aba",
                "abas",
                "ábamos",
                "aban",
                "é",
                "aste",
                "ó",
                "amos",
                "aron",
            ],
            "er": [
                "o",
                "es",
                "e",
                "emos",
                "éis",
                "en",
                "ía",
                "ías",
                "íamos",
                "ían",
                "í",
                "iste",
                "ió",
                "imos",
                "ieron",
            ],
            "ir": [
                "o",
                "es",
                "e",
                "imos",
                "ís",
                "en",
                "ía",
                "ías",
                "íamos",
                "ían",
                "í",
                "iste",
                "ió",
                "imos",
                "ieron",
            ],
        }

    def load_nlp_model(self, silent: bool = False) -> Any:
        """Load the best available Spanish NLP model."""
        model_preferences = NLP_MODEL_PREFERENCES.get("es", [])
        return get_nlp_model("es", model_preferences, silent=silent)

    def analyze_word_linguistics(
        self, word: str, existing_words: Set[str], rank: int = None
    ) -> Tuple[str, str, str]:
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

        # Check for known irregular verb conjugations
        if normalized_word in self.irregular_verb_map:
            base_verb = self.irregular_verb_map[normalized_word]
            if self.normalizer.normalize(base_verb) in existing_words:
                return "inflected_forms", "VERB", f"Conjugated form of '{base_verb}'"

        # Check for regular verb conjugations
        regular_verb_base = self._find_regular_verb_base(
            normalized_word, existing_words
        )
        if regular_verb_base:
            return (
                "inflected_forms",
                "VERB",
                f"Conjugated form of '{regular_verb_base}'",
            )

        # Process with NLP model
        doc = self.nlp_model(word)
        if not doc:
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
            reason = self._get_spanish_inflection_reason(
                word, lemma, morphology, pos_tag
            )
            return "inflected_forms", pos_tag, reason

        # Categorize based on POS and Spanish-specific rules
        category = self._categorize_spanish_word(pos_tag, word, morphology)
        reason = self._generate_spanish_reason(word, pos_tag, morphology)

        return category, pos_tag, reason

    def _find_regular_verb_base(self, word: str, existing_words: Set[str]) -> str:
        """
        Find the base form of a regular Spanish verb conjugation.

        Args:
            word: Potentially conjugated verb
            existing_words: Set of existing words

        Returns:
            Base verb form if found, empty string otherwise
        """
        # Check each verb type (ar, er, ir)
        for ending, conjugations in self.regular_verb_patterns.items():
            for conj in conjugations:
                if word.endswith(conj) and len(word) > len(conj) + 2:
                    # Reconstruct potential infinitive
                    stem = word[: -len(conj)]
                    infinitive = stem + ending

                    if self.normalizer.normalize(infinitive) in existing_words:
                        return infinitive

        return ""

    def _get_spanish_inflection_reason(
        self, word: str, lemma: str, morphology: str, pos_tag: str
    ) -> str:
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
            elif "Tense=Pres" in morphology and "Person=1" in morphology:
                return f"First person present of '{lemma}'"
            elif "Tense=Pres" in morphology and "Person=2" in morphology:
                return f"Second person present of '{lemma}'"
            elif "Tense=Pres" in morphology and "Person=3" in morphology:
                return f"Third person present of '{lemma}'"
            elif "Tense=Imp" in morphology:
                return f"Imperfect tense of '{lemma}'"
            elif "Tense=Fut" in morphology:
                return f"Future tense of '{lemma}'"
            elif "Mood=Sub" in morphology:
                return f"Subjunctive form of '{lemma}'"
            else:
                return f"Conjugated form of '{lemma}'"

        elif pos_tag == "NOUN":
            if "Number=Plur" in morphology:
                return f"Plural form of '{lemma}'"
            elif "Gender=Masc" in morphology and word.endswith("o"):
                return f"Masculine form of '{lemma}'"
            elif "Gender=Fem" in morphology and word.endswith("a"):
                return f"Feminine form of '{lemma}'"
            else:
                return f"Inflected form of '{lemma}'"

        elif pos_tag == "ADJ":
            if "Degree=Cmp" in morphology:
                return f"Comparative form of '{lemma}'"
            elif "Degree=Sup" in morphology:
                return f"Superlative form of '{lemma}'"
            elif "Number=Plur" in morphology and "Gender=Masc" in morphology:
                return f"Masculine plural form of '{lemma}'"
            elif "Number=Plur" in morphology and "Gender=Fem" in morphology:
                return f"Feminine plural form of '{lemma}'"
            elif "Gender=Fem" in morphology:
                return f"Feminine form of '{lemma}'"
            else:
                return f"Inflected adjective form of '{lemma}'"

        else:
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


def main():
    """CLI entry point for Spanish vocabulary analysis."""
    analyzer = SpanishVocabularyAnalyzer()

    # Set up CLI parser
    parser = analyzer.setup_cli_parser(
        "Analyze Spanish vocabulary gaps in LinguaQuiz database"
    )
    args = parser.parse_args()

    # Override migrations directory if provided
    if args.migrations_dir:
        analyzer.db_parser = analyzer.db_parser.__class__(Path(args.migrations_dir))

    # Run analysis
    result = analyzer.analyze_vocabulary_gaps(
        top_n=args.top_n, limit_analysis=args.limit_analysis, show_progress=True
    )

    # Display results
    if args.output_format == "json":
        import json

        print(
            json.dumps(
                {
                    "language": result.language_code,
                    "recommendations": [
                        {
                            "word": a.word,
                            "frequency": a.frequency,
                            "category": a.category,
                            "pos_tag": a.pos_tag,
                            "reason": a.reason,
                        }
                        for a in result.recommendations
                    ],
                },
                indent=2,
            )
        )
    else:
        analyzer.print_analysis_results(result, show_details=not args.hide_details)

    if result.recommendations:
        print(
            f"\n🎉 Found {len(result.recommendations)} Spanish words to consider adding!"
        )


if __name__ == "__main__":
    main()
