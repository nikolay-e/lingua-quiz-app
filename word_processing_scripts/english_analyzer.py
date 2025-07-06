#!/usr/bin/env python3
"""
English Word Analyzer for LinguaQuiz
Leverages advanced NLP to find missing essential English vocabulary.
This version uses the correct SQL file and settings.
"""

import re
import os
from typing import Set, Tuple
from base_analyzer import BaseWordAnalyzer
from wordfreq import word_frequency
from migration_utils import get_language_migration_files, load_spacy_model, normalize_word_generic

class EnglishWordAnalyzer(BaseWordAnalyzer):
    """
    Analyzes English vocabulary using a pure NLP approach to find missing
    essential words for a learning application.
    """
    def __init__(self, migrations_dir=None):
        """Initialize the English analyzer and load NLP models."""
        super().__init__(migrations_dir, language_code="en")
        print("🚀 Initializing English Word Analyzer...")
        
        # Use common model loading function
        model_preferences = ["en_core_web_trf", "en_core_web_lg"]
        self.nlp = load_spacy_model("en", model_preferences)

    def normalize_word(self, word: str) -> str:
        """Normalizes a word by lowercasing and removing extra info."""
        word = re.sub(r'\s*\([^)]*\)', '', word)
        return normalize_word_generic(word.strip())

    def get_migration_filename(self) -> str:
        """Get the migration filename for English."""
        return get_language_migration_files()['en']

    def get_existing_words(self) -> Set[str]:
        """
        Extracts all existing English words from the specified A1 migration file.
        """
        english_file = os.path.join(self.migrations_dir, self.get_migration_filename())
        
        data = self.extract_data_from_file(english_file)
        english_words = set()
        
        for _, _, _, raw_word, translation, _, _ in data:
            if raw_word:
                # Skip obvious placeholder entries (word with translation 'translation')
                if raw_word == 'word' and translation == 'translation':
                    continue
                # Use common word processing method without modifying commas
                # English typically uses pipes for alternatives, not commas
                english_words.update(self.process_word_variants(raw_word))
        
        return english_words

    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """
        Analyzes a single word using spaCy for a comprehensive, NLP-driven classification.
        """
        doc = self.nlp(word)
        token = doc[0]
        
        lemma = token.lemma_.lower()
        pos_tag = token.pos_
        morphology = str(token.morph)

        # This check is now effective because `existing_words` is populated correctly.
        if lemma != word.lower() and lemma in existing_words:
            reason = f"Inflected form of '{lemma}'"
            if "Tense=Past" in morphology:
                reason = f"Past tense of '{lemma}'"
            elif "Number=Plur" in morphology:
                reason = f"Plural of '{lemma}'"
            elif "Degree=Cmp" in morphology:
                reason = f"Comparative form of '{lemma}' (e.g., bigger)"
            elif "Degree=Sup" in morphology:
                reason = f"Superlative form of '{lemma}' (e.g., biggest)"
            elif "VerbForm=Ger" in morphology:
                reason = f"Gerund or present participle of '{lemma}' (e.g., walking)"
            return 'inflected_form', pos_tag, reason

        if token.ent_type_ or pos_tag == 'PROPN':
            return 'proper_noun', pos_tag, f"Proper noun ({token.ent_type_ or 'Name'})"
            
        if "'" in word and pos_tag != 'NOUN':
             if lemma in existing_words:
                 return 'inflected_form', pos_tag, f"Contraction of '{lemma}' (e.g., it's, don't)"

        if pos_tag in ['PUNCT', 'SYM', 'SPACE', 'X']:
            return 'symbol_or_other', pos_tag, "Symbol, punctuation, or non-linguistic token"
        
        if token.is_stop or pos_tag in ['ADP', 'AUX', 'CCONJ', 'SCONJ', 'DET', 'PART', 'PRON']:
            return 'grammatical_word', pos_tag, "Grammatical function word"
            
        freq = word_frequency(word.lower(), 'en')

        if pos_tag in self.pos_thresholds:
            if freq >= self.pos_thresholds[pos_tag]:
                if pos_tag in self.category_mapping:
                    return self.category_mapping[pos_tag], pos_tag, f'High-frequency {pos_tag}'
            else:
                return 'low_frequency', pos_tag, f"Too infrequent for learners (freq: {freq:.6f})"
        
        return 'other', pos_tag, "Uncategorized word"

def main():
    """Main entry point to run the analyzer from the command line."""
    analyzer = EnglishWordAnalyzer()
    analyzer.run_main('Analyze English words for LinguaQuiz using NLP.')

if __name__ == "__main__":
    main()