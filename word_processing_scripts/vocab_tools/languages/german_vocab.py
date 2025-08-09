"""
German vocabulary analyzer for LinguaQuiz.

Specialized analyzer for German vocabulary with proper handling of
German linguistic features like articles, compound words, and inflections.
"""

from typing import Set, Tuple, List, Any
from pathlib import Path

from ..core.vocabulary_analyzer import VocabularyAnalyzer
from ..core.nlp_models import get_nlp_model
from ..config.constants import NLP_MODEL_PREFERENCES, WORD_CATEGORY_MAPPING


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
            print(f"🇩🇪 Initializing German vocabulary analyzer...")
        
        # German-specific configurations
        self.german_articles = {
            'der', 'die', 'das', 'den', 'dem', 'des',
            'ein', 'eine', 'einer', 'einen', 'einem', 'eines'
        }
        
        # Common German verb inflection mappings
        self.verb_inflection_map = {
            # sein (to be)
            'bin': 'sein', 'bist': 'sein', 'ist': 'sein', 'sind': 'sein',
            'war': 'sein', 'warst': 'sein', 'waren': 'sein',
            'gewesen': 'sein',
            
            # haben (to have)  
            'habe': 'haben', 'hast': 'haben', 'hat': 'haben',
            'hatte': 'haben', 'hattest': 'haben', 'hatten': 'haben',
            'gehabt': 'haben',
            
            # werden (to become)
            'werde': 'werden', 'wirst': 'werden', 'wird': 'werden',
            'wurde': 'werden', 'wurdest': 'werden', 'wurden': 'werden',
            'geworden': 'werden',
        }
    
    def load_nlp_model(self, silent: bool = False) -> Any:
        """Load the best available German NLP model."""
        model_preferences = NLP_MODEL_PREFERENCES.get("de", [])
        return get_nlp_model("de", model_preferences, silent=silent)
    
    def analyze_word_linguistics(self, word: str, existing_words: Set[str], rank: int = None) -> Tuple[str, str, str]:
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
        
        # Check for known verb inflections first
        if normalized_word in self.verb_inflection_map:
            base_verb = self.verb_inflection_map[normalized_word]
            if base_verb in existing_words:
                return "inflected_forms", "VERB", f"Conjugated form of '{base_verb}'"
        
        # Process with NLP model
        doc = self.nlp_model(word)
        if not doc:
            return "other", "UNKNOWN", "NLP processing failed"
        
        token = doc[0]
        lemma = token.lemma_.lower()
        pos_tag = token.pos_
        morphology = str(token.morph) if hasattr(token, 'morph') else ""
        
        # Filter out proper nouns (names, places, brands) - focus on core vocabulary
        if token.ent_type_ and token.ent_type_ not in ["ORDINAL", "CARDINAL"]:
            return "proper_noun", token.ent_type_, f"Filtered out as named entity: {token.ent_type_}"
        
        # Check for lemma in existing words (after German normalization)
        normalized_lemma = self.normalizer.normalize(lemma)
        if normalized_lemma != normalized_word and normalized_lemma in existing_words:
            reason = self._get_german_inflection_reason(word, lemma, morphology, pos_tag)
            return "inflected_forms", pos_tag, reason
        
        # Check for compound word components
        compound_reason = self._check_compound_word(word, existing_words)
        if compound_reason:
            return "compound_forms", "NOUN", compound_reason
        
        # Categorize based on POS and German-specific rules
        category = self._categorize_german_word(pos_tag, word, morphology)
        reason = self._generate_german_reason(word, pos_tag, morphology)
        
        return category, pos_tag, reason
    
    def _get_german_inflection_reason(self, word: str, lemma: str, morphology: str, pos_tag: str) -> str:
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
    
    def _check_compound_word(self, word: str, existing_words: Set[str]) -> str:
        """
        Check if word might be a German compound word with known components.
        
        Args:
            word: Word to check for compound structure
            existing_words: Set of existing words
            
        Returns:
            Reason string if compound found, empty string otherwise
        """
        if len(word) < 6:  # Too short to be a meaningful compound
            return ""
        
        # Simple compound detection - check if word ends with known words
        normalized_word = self.normalizer.normalize(word)
        
        for existing_word in existing_words:
            if len(existing_word) >= 3 and normalized_word.endswith(existing_word):
                # Check if the remaining part might also be a word
                prefix = normalized_word[:-len(existing_word)]
                if len(prefix) >= 3 and prefix in existing_words:
                    return f"Compound word: {prefix} + {existing_word}"
        
        return ""
    
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


def main():
    """CLI entry point for German vocabulary analysis."""
    analyzer = GermanVocabularyAnalyzer()
    
    # Set up CLI parser
    parser = analyzer.setup_cli_parser(
        "Analyze German vocabulary gaps in LinguaQuiz database"
    )
    args = parser.parse_args()
    
    # Override migrations directory if provided
    if args.migrations_dir:
        analyzer.db_parser = analyzer.db_parser.__class__(Path(args.migrations_dir))
    
    # Run analysis
    result = analyzer.analyze_vocabulary_gaps(
        top_n=args.top_n,
        limit_analysis=args.limit_analysis,
        show_progress=True
    )
    
    # Display results
    if args.output_format == 'json':
        import json
        print(json.dumps({
            'language': result.language_code,
            'recommendations': [
                {
                    'word': a.word,
                    'frequency': a.frequency,
                    'category': a.category,
                    'pos_tag': a.pos_tag,
                    'reason': a.reason
                }
                for a in result.recommendations
            ]
        }, indent=2))
    else:
        analyzer.print_analysis_results(result, show_details=not args.hide_details)
    
    if result.recommendations:
        print(f"\n🎉 Found {len(result.recommendations)} German words to consider adding!")


if __name__ == "__main__":
    main()