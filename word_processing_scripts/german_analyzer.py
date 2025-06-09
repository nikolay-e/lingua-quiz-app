#!/usr/bin/env python3
"""
Perfect German Word Analyzer for LinguaQuiz
Combines NLP + linguistic patterns to find missing essential German vocabulary
"""

import spacy
import re
import os
import sys
import argparse
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
from wordfreq import word_frequency, top_n_list
import unicodedata

class GermanAnalyzer:
    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize the German analyzer"""
        print("🚀 Initializing German Word Analyzer...")
        
        # Load spaCy German model
        try:
            self.nlp = spacy.load("de_core_news_lg")
            print("✅ German NLP model loaded")
        except OSError:
            print("📦 Installing German NLP model...")
            import subprocess
            subprocess.run([sys.executable, "-m", "spacy", "download", "de_core_news_lg"])
            self.nlp = spacy.load("de_core_news_lg")
        
        # Set migrations directory
        if migrations_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            migrations_dir = os.path.join(script_dir, "..", "packages", "backend", "migrations")
        self.migrations_dir = os.path.abspath(migrations_dir)
        
        # Initialize linguistic patterns
        self._setup_patterns()
    
    def _setup_patterns(self):
        """Setup German linguistic patterns for analysis"""
        
        # Verb ending patterns
        self.verb_endings = {
            'st': {'person': 2, 'tense': 'present'},
            't': {'person': 3, 'tense': 'present'},
            'e': {'person': 1, 'tense': 'present'},
            'en': {'tense': 'infinitive'},
            'et': {'person': 2, 'tense': 'present'},
            'te': {'tense': 'past'},
            'test': {'person': 2, 'tense': 'past'},
            'ten': {'tense': 'past', 'plural': True},
            'tet': {'tense': 'past'},
        }
        
        # Adjective ending patterns
        self.adj_endings = {
            'er': {'case': 'nom', 'gender': 'masc', 'strong': True},
            'es': {'case': 'nom/acc', 'gender': 'neut', 'strong': True},
            'e': {'case': 'nom/acc', 'gender': 'fem', 'strong': True},
            'en': {'case': 'gen/dat', 'strong': True},
            'em': {'case': 'dat', 'gender': 'masc/neut', 'strong': True},
        }
        
        # Swiss German vs Standard German mappings (only special cases that need exact mapping)
        self.swiss_standard_words = {
            # Common words that need exact mapping (patterns handle the rest)
            'heisst': 'heißt',
            'weiss': 'weiß',
            'ausserdem': 'außerdem',
            'schliesslich': 'schließlich',
        }
        
        # POS tag thresholds for essential words
        self.pos_thresholds = {
            'VERB': 0.00005,
            'NOUN': 0.00004,
            'ADJ': 0.00005,
            'ADV': 0.00005,
            'CCONJ': 0.00005,
            'SCONJ': 0.00005,
        }
    
    def normalize_word(self, word: str) -> str:
        """Normalize German word by removing articles and declension info"""
        # Remove articles at the beginning
        word = re.sub(r'^(der|die|das)\s+', '', word, flags=re.IGNORECASE)
        
        # Remove everything after semicolon or comma (plural forms, declensions)
        if ';' in word:
            word = word.split(';')[0].strip()
        elif ',' in word:
            word = word.split(',')[0].strip()
        
        # Remove the article again if it's still there after semicolon split
        word = re.sub(r'^(der|die|das)\s+', '', word, flags=re.IGNORECASE)
        
        return word.lower()
    
    def extract_data_from_file(self, file_path: str) -> List[Tuple]:
        """Extract data tuples from migration file"""
        data = []
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Pattern to match data tuples
        pattern = r'\(\s*(\d+),\s*(\d+),\s*(\d+),\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\',\s*\'([^\']*)\'\s*\)'
        matches = re.findall(pattern, content)
        
        for match in matches:
            try:
                id1, id2, id3, word, translation, example, example_translation = match
                data.append((int(id1), int(id2), int(id3), word, translation, example, example_translation))
            except ValueError:
                continue
        
        return data
    
    def get_existing_german_words(self) -> Set[str]:
        """Extract all existing German words from the migration file"""
        # Find German migration file
        german_file = os.path.join(self.migrations_dir, "901_german_russian_words.sql")
        if not os.path.exists(german_file):
            raise FileNotFoundError(f"German migration file not found: {german_file}")
        
        data = self.extract_data_from_file(german_file)
        german_words = set()
        
        for id1, id2, id3, word, translation, example, example_translation in data:
            if word and word != 'word':
                # Handle compound phrases like "ein bisschen"
                if ' ' in word:
                    # Add the full normalized phrase
                    normalized_full = self.normalize_word(word)
                    german_words.add(normalized_full)
                    
                    # Extract individual meaningful words (skip articles)
                    skip_words = {'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines'}
                    for part in word.split():
                        part_normalized = self.normalize_word(part.strip())
                        if part_normalized not in skip_words and len(part_normalized) > 2:
                            german_words.add(part_normalized)
                else:
                    normalized = self.normalize_word(word)
                    german_words.add(normalized)
                
                # Handle pipe-separated alternatives
                if '|' in word:
                    for alt in word.split('|'):
                        alt_normalized = self.normalize_word(alt.strip())
                        german_words.add(alt_normalized)
                        
                        # Also handle spaces in alternatives
                        if ' ' in alt:
                            for part in alt.split():
                                part_normalized = self.normalize_word(part.strip())
                                skip_words = {'der', 'die', 'das', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines'}
                                if part_normalized not in skip_words and len(part_normalized) > 2:
                                    german_words.add(part_normalized)
        
        return german_words
    
    def detect_verb_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is a verb inflection"""
        word_lower = word.lower()
        
        for ending, properties in self.verb_endings.items():
            if word_lower.endswith(ending):
                stem = word_lower[:-len(ending)]
                
                # Try common infinitive formations
                possible_infinitives = [stem + 'en', stem + 'n']
                
                # Handle stem changes (ä→a, ö→o, ü→u)
                if len(stem) > 2:
                    if 'ä' in stem:
                        possible_infinitives.append(stem.replace('ä', 'a') + 'en')
                    if 'ö' in stem:
                        possible_infinitives.append(stem.replace('ö', 'o') + 'en')
                    if 'ü' in stem:
                        possible_infinitives.append(stem.replace('ü', 'u') + 'en')
                
                # Check if any possible infinitive exists
                for inf in possible_infinitives:
                    if inf in existing_words:
                        tense_info = properties.get('tense', 'conjugated')
                        person_info = f"person {properties.get('person')}" if 'person' in properties else ""
                        return inf, f"{tense_info} form of '{inf}' {person_info}".strip()
        
        return None
    
    def detect_adjective_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is an adjective declension"""
        word_lower = word.lower()
        
        for ending, properties in self.adj_endings.items():
            if word_lower.endswith(ending) and len(word_lower) > len(ending) + 2:
                stem = word_lower[:-len(ending)]
                
                # Possible base forms
                possible_bases = [stem, stem + 'e', stem + 'er', stem + 'el', stem + 'en']
                
                # Check if any base form exists
                for base in possible_bases:
                    if base in existing_words:
                        declension_info = []
                        if 'case' in properties:
                            declension_info.append(properties['case'])
                        if properties.get('strong'):
                            declension_info.append('strong')
                        
                        return base, f"Declined form of '{base}' ({', '.join(declension_info)})"
        
        return None
    
    def detect_spelling_variant(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect Swiss German or alternative spellings using patterns"""
        word_lower = word.lower()
        
        # Check direct Swiss/Standard word mappings first
        if word_lower in self.swiss_standard_words:
            standard_form = self.swiss_standard_words[word_lower]
            if standard_form in existing_words:
                return standard_form, f"Swiss German spelling of '{standard_form}'"
            
            # For verbs like heisst→heißt, check if the infinitive form exists
            if standard_form.endswith('t'):
                infinitive_candidates = [
                    standard_form[:-1] + 'en',  # heißt → heißen
                    standard_form + 'en',       # might work for some cases
                ]
                for candidate in infinitive_candidates:
                    if candidate in existing_words:
                        return candidate, f"Swiss German spelling of conjugated form - related to '{candidate}'"
        
        # Pattern-based Swiss German → Standard German replacements
        swiss_patterns = [
            ('ss', 'ß'),   # Swiss ss → Standard ß
            ('ae', 'ä'),   # Swiss ae → Standard ä  
            ('oe', 'ö'),   # Swiss oe → Standard ö
            ('ue', 'ü'),   # Swiss ue → Standard ü
        ]
        
        for swiss_pattern, standard_pattern in swiss_patterns:
            if swiss_pattern in word_lower:
                # Try replacement
                standard_candidate = word_lower.replace(swiss_pattern, standard_pattern)
                if standard_candidate in existing_words:
                    return standard_candidate, f"Swiss German spelling of '{standard_candidate}' ({swiss_pattern}→{standard_pattern})"
                
                # Also try the reverse (standard → Swiss) in case the word exists in Swiss form
                if standard_pattern in word_lower:
                    swiss_candidate = word_lower.replace(standard_pattern, swiss_pattern)
                    if swiss_candidate in existing_words:
                        return swiss_candidate, f"Standard German spelling of '{swiss_candidate}'"
        
        return None
    
    def detect_plural_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is a plural form"""
        word_lower = word.lower()
        
        # Check common plural endings
        plural_endings = ['e', 'er', 'en', 'n', 's']
        
        for ending in plural_endings:
            if word_lower.endswith(ending):
                possible_singular = word_lower[:-len(ending)]
                
                # Also check with umlaut reversal
                umlaut_reversals = [
                    (possible_singular, possible_singular),
                    (possible_singular.replace('ä', 'a'), possible_singular),
                    (possible_singular.replace('ö', 'o'), possible_singular),
                    (possible_singular.replace('ü', 'u'), possible_singular),
                ]
                
                for singular, original in umlaut_reversals:
                    if singular in existing_words:
                        return singular, f"Plural of '{singular}'"
        
        return None
    
    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """Analyze a single word using NLP + patterns"""
        # Use spaCy for basic analysis
        doc = self.nlp(word)
        if not doc:
            return 'other', 'UNKNOWN', 'Could not analyze'
        
        token = doc[0]
        lemma = token.lemma_.lower()
        
        # Check if lemma exists (and is different from word)
        if lemma != word.lower() and lemma in existing_words:
            return f'inflected_{token.pos_.lower()}', token.pos_, f'Form of "{lemma}"'
        
        # Try pattern-based detection in order of priority
        
        # 1. Spelling variants FIRST
        spelling_result = self.detect_spelling_variant(word, existing_words)
        if spelling_result:
            base, reason = spelling_result
            return 'spelling_variants', token.pos_, reason
        
        # 2. Verb forms
        verb_result = self.detect_verb_form(word, existing_words)
        if verb_result:
            base, reason = verb_result
            return 'inflected_verbs', token.pos_, reason
        
        # 3. Adjective forms
        adj_result = self.detect_adjective_form(word, existing_words)
        if adj_result:
            base, reason = adj_result
            return 'inflected_adjectives', token.pos_, reason
        
        # 4. Plural forms
        plural_result = self.detect_plural_form(word, existing_words)
        if plural_result:
            base, reason = plural_result
            return 'inflected_nouns', token.pos_, reason
        
        # Check if it's a proper noun
        if token.pos_ == 'PROPN' or token.ent_type_:
            return 'proper_nouns', token.pos_, f'Proper noun ({token.ent_type_ or "name"})'
        
        # Check for English loanwords that shouldn't be in German learning
        english_loanwords = {
            'ok', 'okay', 'cool', 'wow', 'hey', 'hi', 'bye', 'sorry', 'baby', 
            'party', 'team', 'job', 'boss', 'email', 'computer', 'internet',
            'facebook', 'google', 'twitter', 'youtube', 'blog', 'chat'
        }
        if word.lower() in english_loanwords:
            return 'english_loanwords', token.pos_, 'English loanword - not suitable for German learning'
        
        # Check for essential categories with frequency
        freq = word_frequency(word.lower(), 'de')
        
        if token.pos_ in ['DET', 'PRON', 'ADP', 'PART']:
            return 'grammatical_words', token.pos_, 'Grammatical word'
        
        if token.pos_ in self.pos_thresholds and freq >= self.pos_thresholds[token.pos_]:
            category_map = {
                'VERB': 'essential_verbs',
                'NOUN': 'essential_nouns',
                'ADJ': 'essential_adjectives',
                'ADV': 'essential_adverbs',
                'CCONJ': 'essential_conjunctions',
                'SCONJ': 'essential_conjunctions',
            }
            return category_map[token.pos_], token.pos_, f'High-frequency {token.pos_}'
        
        if freq < 0.00002:
            return 'low_frequency', token.pos_, f'Low frequency'
        
        return 'other', token.pos_, f'Uncategorized {token.pos_}'
    
    def analyze(self, top_n: int = 1000, show_details: bool = True) -> List[Tuple[str, float, str, str]]:
        """Main analysis function"""
        if show_details:
            print("\n🔍 GERMAN WORD ANALYSIS")
            print("="*80)
        
        # Get existing words
        existing_words = self.get_existing_german_words()
        if show_details:
            print(f"Found {len(existing_words)} existing German words")
        
        # Get top N German words
        raw_german = top_n_list('de', top_n)
        top_german = [w for w in raw_german if not w.isdigit() and len(w) > 1]
        
        # Find missing words
        missing_words = []
        for word in top_german:
            normalized = word.lower()
            if normalized not in existing_words:
                missing_words.append(word)
        
        if show_details:
            print(f"Found {len(missing_words)} missing words from top {top_n}")
            print("Analyzing using NLP + linguistic patterns...")
        
        # Analyze words
        categories = defaultdict(list)
        
        for word in missing_words:
            category, pos_tag, reason = self.analyze_word(word, existing_words)
            freq = word_frequency(word.lower(), 'de')
            categories[category].append((word, freq, reason, pos_tag))
        
        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x[1], reverse=True)
        
        # Generate recommendations
        recommendations = []
        for category in ['essential_verbs', 'essential_nouns', 'essential_adjectives', 
                        'essential_adverbs', 'essential_conjunctions']:
            if category in categories:
                for word, freq, reason, pos_tag in categories[category]:
                    recommendations.append((word, freq, category, f"{reason} [{pos_tag}]"))
        
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        if show_details:
            self._display_results(dict(categories), recommendations)
        
        return recommendations[:30]
    
    def _display_results(self, categories: Dict, recommendations: List):
        """Display analysis results"""
        print(f"\n✅ WORDS TO ADD:")
        
        total_to_add = 0
        for cat_name, cat_display in [
            ('essential_verbs', '🟢 ESSENTIAL VERBS'),
            ('essential_nouns', '🟢 ESSENTIAL NOUNS'),
            ('essential_adjectives', '🟢 ESSENTIAL ADJECTIVES'),
            ('essential_adverbs', '🟢 ESSENTIAL ADVERBS'),
            ('essential_conjunctions', '🟢 ESSENTIAL CONJUNCTIONS')
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}):")
                for word, freq, reason, pos_tag in categories[cat_name][:10]:
                    print(f"   ✅ {word:15s} (freq: {freq:.6f}) - {reason}")
                total_to_add += len(categories[cat_name])
        
        print(f"\n❌ WORDS NOT TO ADD:")
        
        total_not_to_add = 0
        for cat_name, cat_display, explanation in [
            ('inflected_verbs', '🔴 VERB INFLECTIONS', 'Detected by morphological patterns'),
            ('inflected_adjectives', '🔴 ADJECTIVE DECLENSIONS', 'Detected by ending patterns'),
            ('inflected_nouns', '🔴 PLURAL FORMS', 'Detected by plural patterns'),
            ('spelling_variants', '🔴 SPELLING VARIANTS', 'Swiss German / alternative spellings'),
            ('english_loanwords', '🔴 ENGLISH LOANWORDS', 'Not suitable for German learning'),
            ('proper_nouns', '🔴 PROPER NOUNS', 'Named entities'),
            ('grammatical_words', '🔴 GRAMMATICAL WORDS', 'Function words'),
            ('low_frequency', '🔴 LOW FREQUENCY', 'Too rare for practical use')
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}): DON'T ADD")
                print(f"   Reason: {explanation}")
                # Show examples for key categories
                if cat_name in ['inflected_verbs', 'inflected_adjectives', 'spelling_variants']:
                    examples = categories[cat_name][:5]
                    for word, freq, reason, pos in examples:
                        print(f"   Example: {word} - {reason}")
                total_not_to_add += len(categories[cat_name])
        
        print(f"\n🎯 FINAL RECOMMENDATIONS:")
        print("="*80)
        print(f"TOP {min(30, len(recommendations))} WORDS TO ADD:")
        
        for i, (word, freq, category, reason) in enumerate(recommendations[:30], 1):
            cat_short = category.replace('essential_', '').upper()[:6]
            print(f"{i:2d}. {word:15s} (freq: {freq:.6f}) [{cat_short:6s}] - {reason}")
        
        print(f"\n📊 SUMMARY:")
        print(f"   ✅ Recommend adding: {total_to_add} words")
        print(f"   ❌ Don't add: {total_not_to_add} words")
        print(f"   🎨 Using: NLP + Linguistic patterns")
        
        if 'other' in categories:
            print(f"   🔍 Uncategorized: {len(categories['other'])} words")

def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Analyze German words for LinguaQuiz')
    parser.add_argument('--top-n', type=int, default=1000, 
                       help='Number of top frequency words to analyze (default: 1000)')
    parser.add_argument('--no-details', action='store_true',
                       help='Suppress detailed output')
    args = parser.parse_args()
    
    analyzer = GermanAnalyzer()
    recommendations = analyzer.analyze(top_n=args.top_n, show_details=not args.no_details)
    
    if recommendations:
        print(f"\n💡 Found {len(recommendations)} German words that could be added")

if __name__ == "__main__":
    main()