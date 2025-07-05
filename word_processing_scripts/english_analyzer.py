#!/usr/bin/env python3
"""
English Word Analyzer for LinguaQuiz
Leverages advanced NLP to find missing essential English vocabulary.
This version uses the correct SQL file and settings.
"""

import spacy
import re
import os
import sys
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
from wordfreq import word_frequency, top_n_list

class EnglishWordAnalyzer:
    """
    Analyzes English vocabulary using a pure NLP approach to find missing
    essential words for a learning application.
    """
    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize the English analyzer and load NLP models."""
        print("🚀 Initializing English Word Analyzer...")
        
        try:
            self.nlp = spacy.load("en_core_web_trf")
            print("✅ Loaded spaCy transformer model (en_core_web_trf) for best accuracy.")
        except OSError:
            print("⚠️ Transformer model not found. Falling back to large model.")
            try:
                self.nlp = spacy.load("en_core_web_lg")
                print("✅ Loaded spaCy large model (en_core_web_lg).")
            except OSError:
                print("📦 Large model not found. Downloading and installing...")
                import subprocess
                subprocess.run([sys.executable, "-m", "spacy", "download", "en_core_web_lg"])
                self.nlp = spacy.load("en_core_web_lg")

        if migrations_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            migrations_dir = os.path.join(script_dir, "..", "packages", "backend", "migrations")
        self.migrations_dir = os.path.abspath(migrations_dir)
        
        self.pos_thresholds = {
            'VERB': 0.00005,
            'NOUN': 0.00004,
            'ADJ':  0.00005,
            'ADV':  0.00006,
        }

    def normalize_word(self, word: str) -> str:
        """Normalizes a word by lowercasing and removing extra info."""
        word = re.sub(r'\s*\([^)]*\)', '', word)
        return word.strip().lower()

    def extract_data_from_file(self, file_path: str) -> List[Tuple]:
        """
        Extracts the source word column from a SQL migration file.
        """
        data = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
        except FileNotFoundError:
            print(f"❌ Error: Migration file not found at {file_path}")
            print("Returning empty word list. Analysis will suggest all words are new.")
            return []

        pattern = r'\(\s*(\d+),\s*(\d+),\s*(\d+),\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\'\s*\)'
        matches = re.findall(pattern, content)
        
        for match in matches:
            source_word = match[3]
            data.append((source_word,))
        
        return data

    def get_existing_english_words(self) -> Set[str]:
        """
        Extracts all existing English words from the specified A1 migration file.
        """
        # CORRECTED: Using the correct 'a1' filename.
        english_file = os.path.join(self.migrations_dir, "903_english_russian_a1_words.sql")
        
        data = self.extract_data_from_file(english_file)
        english_words = set()
        
        for (raw_word,) in data:
            if raw_word and raw_word.lower() != 'word':
                processed_word = raw_word.replace(',', '|')
                for part in processed_word.split('|'):
                    normalized = self.normalize_word(part)
                    if normalized:
                        english_words.add(normalized)
        
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
                category_map = {
                    'VERB': 'essential_verbs',
                    'NOUN': 'essential_nouns',
                    'ADJ':  'essential_adjectives',
                    'ADV':  'essential_adverbs',
                }
                return category_map[pos_tag], pos_tag, f'High-frequency {pos_tag}'
            else:
                return 'low_frequency', pos_tag, f"Too infrequent for learners (freq: {freq:.6f})"
        
        return 'other', pos_tag, "Uncategorized word"


    def analyze(self, top_n: int = 1000, show_details: bool = True) -> List[Tuple[str, float, str, str]]:
        """Main analysis function."""
        if show_details:
            print("\n🔍 ENGLISH WORD ANALYSIS (NLP-DRIVEN)")
            print("=" * 80)
        
        existing_words = self.get_existing_english_words()
        if show_details:
            print(f"Found {len(existing_words)} existing English words in the database.")
        
        raw_english = top_n_list('en', top_n)
        top_english = [w for w in raw_english if not w.isdigit() and len(w) > 1]
        
        missing_words = [word for word in top_english if self.normalize_word(word) not in existing_words]
        
        if show_details:
            print(f"Found {len(missing_words)} missing words from the top {top_n} most frequent.")
            print("Analyzing missing words using the NLP model...")
        
        categories = defaultdict(list)
        for word in missing_words:
            category, pos_tag, reason = self.analyze_word(word, existing_words)
            freq = word_frequency(word.lower(), 'en')
            categories[category].append((word, freq, reason, pos_tag))
        
        for category in categories:
            categories[category].sort(key=lambda x: x[1], reverse=True)
            
        recommendations = []
        for category in ['essential_verbs', 'essential_nouns', 'essential_adjectives', 'essential_adverbs']:
            if category in categories:
                for word, freq, reason, pos_tag in categories[category]:
                    recommendations.append((word, freq, category, f"{reason} [{pos_tag}]"))
        
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        if show_details:
            self._display_results(dict(categories), recommendations)
            
        return recommendations

    def _display_results(self, categories: Dict, recommendations: List):
        """Prints a formatted and complete summary of the analysis results."""
        
        print("\n" + "="*80)
        print("✅ FULL REPORT: WORDS TO ADD (Recommended)")
        print("="*80)

        total_to_add = 0
        for cat_name, cat_display in [
            ('essential_verbs', '🟢 ESSENTIAL VERBS'),
            ('essential_nouns', '🟢 ESSENTIAL NOUNS'),
            ('essential_adjectives', '🟢 ESSENTIAL ADJECTIVES'),
            ('essential_adverbs', '🟢 ESSENTIAL ADVERBS'),
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}):")
                for word, freq, reason, pos_tag in categories[cat_name]:
                    print(f"   ✅ {word:15s} (freq: {freq:.6f}) - {reason}")
                total_to_add += len(categories[cat_name])

        print("\n" + "="*80)
        print("❌ FULL REPORT: WORDS TO IGNORE (Filtered by NLP)")
        print("="*80)

        total_not_to_add = 0
        for cat_name, cat_display, explanation in [
            ('inflected_form', '🔴 INFLECTED FORMS', "Base form likely exists (e.g., plurals, tenses)"),
            ('proper_noun', '🔴 PROPER NOUNS', "Names of people, places, etc. Not general vocabulary."),
            ('grammatical_word', '🔴 GRAMMATICAL WORDS', "Function words (articles, prepositions, etc.)"),
            ('low_frequency', '🔴 LOW FREQUENCY', "Too rare for beginner/intermediate learners."),
            ('symbol_or_other', '🔴 SYMBOLS & OTHER', "Non-lexical items."),
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}):")
                print(f"   Reason: {explanation}")
                for word, freq, reason, pos in categories[cat_name]:
                    print(f"   - {word:20s} (freq: {freq:.6f}) | Filtered because: {reason}")
                total_not_to_add += len(categories[cat_name])

        print("\n" + "="*80)
        print("🎯 COMPLETE LIST OF FINAL RECOMMENDATIONS")
        print("="*80)
        
        print(f"Found {len(recommendations)} words recommended for addition, ranked by frequency:")
        for i, (word, freq, category, reason) in enumerate(recommendations, 1):
            cat_short = category.replace('essential_', '').upper()[:4]
            print(f"{i:3d}. {word:15s} (freq: {freq:.6f}) [{cat_short}]")

        print("\n📊 OVERALL STATS:")
        print(f"   ✅ Recommend adding: {total_to_add} words")
        print(f"   ❌ Recommend ignoring: {total_not_to_add} words")
        if 'other' in categories:
            print(f"   🔍 Uncategorized: {len(categories['other'])} words need manual review")

def main():
    """Main entry point to run the analyzer from the command line."""
    import argparse
    parser = argparse.ArgumentParser(description='Analyze English words for LinguaQuiz using NLP.')
    
    # CORRECTED: Default for top-n is now 1000.
    parser.add_argument('--top-n', type=int, default=1000, 
                       help='Number of top frequency words to analyze (default: 1000)')
    parser.add_argument('--hide-details', action='store_true',
                       help='Suppress the detailed category-by-category report output.')
    parser.add_argument('--migrations-dir', type=str, default=None,
                       help='Path to the migrations directory. Defaults to a relative path.')
    args = parser.parse_args()
    
    analyzer = EnglishWordAnalyzer(migrations_dir=args.migrations_dir)
    recommendations = analyzer.analyze(top_n=args.top_n, show_details=not args.hide_details)
    
    if recommendations:
        print(f"\n🎉 Analysis complete. Found {len(recommendations)} potential new English words to add.")

if __name__ == "__main__":
    main()