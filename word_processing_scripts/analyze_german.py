#!/usr/bin/env python3
"""
Hybrid German Word Analysis - Pattern-Based NLP
Combines NLP with linguistic patterns (not hardcoded word lists)
"""

import spacy
import re
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
from wordfreq import word_frequency, top_n_list
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from validate_migrations import MigrationValidator

class HybridGermanAnalyzer:
    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize with spaCy and linguistic patterns"""
        # Load spaCy
        try:
            self.nlp = spacy.load("de_core_news_lg")
        except OSError:
            print("Installing spaCy German model...")
            import subprocess
            subprocess.run([sys.executable, "-m", "spacy", "download", "de_core_news_lg"])
            self.nlp = spacy.load("de_core_news_lg")
        
        if migrations_dir is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            migrations_dir = os.path.join(script_dir, "..", "packages", "backend", "migrations")
        
        self.migrations_dir = os.path.abspath(migrations_dir)
        self.validator = MigrationValidator(self.migrations_dir)
        
        # Define PATTERNS (not word lists) for German morphology
        self.define_linguistic_patterns()
    
    def define_linguistic_patterns(self):
        """Define linguistic patterns instead of hardcoded words"""
        
        # Verb ending patterns for different tenses/persons
        self.verb_endings = {
            # Present tense
            'st': {'person': 2, 'tense': 'present'},  # du verb-st
            't': {'person': 3, 'tense': 'present'},   # er/sie/es verb-t
            'e': {'person': 1, 'tense': 'present'},   # ich verb-e
            'en': {'tense': 'infinitive'},            # infinitive
            'et': {'person': 2, 'tense': 'present'},  # ihr verb-et
            # Past tense
            'te': {'tense': 'past'},
            'test': {'person': 2, 'tense': 'past'},
            'ten': {'tense': 'past', 'plural': True},
            'tet': {'tense': 'past'},
            # Past participle
            'ge.*t': {'tense': 'past_participle', 'weak': True},
            'ge.*en': {'tense': 'past_participle', 'strong': True},
        }
        
        # Strong verb stem changes (patterns, not words)
        self.strong_verb_patterns = [
            # Pattern: (present_pattern, past_pattern, past_participle_pattern)
            (r'ass', r'ieß|iess', r'ass'),     # lassen, ließ, gelassen
            (r'eiß|eiss', r'ieß|iess', r'eiß'), # heißen, hieß, geheißen
            (r'ei', r'ie', r'ie'),     # bleiben, blieb, geblieben
            (r'ei', r'i', r'i'),       # greifen, griff, gegriffen
            (r'ie', r'o', r'o'),       # fliegen, flog, geflogen
            (r'i', r'a', r'u'),        # finden, fand, gefunden
            (r'e', r'a', r'o'),        # nehmen, nahm, genommen
            (r'e', r'a', r'e'),        # geben, gab, gegeben
            (r'a', r'u', r'a'),        # fahren, fuhr, gefahren
            (r'a', r'ie', r'a'),       # fallen, fiel, gefallen
            (r'au', r'ie', r'au'),     # laufen, lief, gelaufen
        ]
        
        # Adjective declension patterns
        self.adj_endings = {
            # Strong declension
            'er': {'case': 'nom', 'gender': 'masc', 'strong': True},
            'es': {'case': 'nom/acc', 'gender': 'neut', 'strong': True},
            'e': {'case': 'nom/acc', 'gender': 'fem', 'strong': True},
            'en': {'case': 'gen/dat', 'strong': True},
            'em': {'case': 'dat', 'gender': 'masc/neut', 'strong': True},
            # Weak declension
            'e': {'weak': True, 'case': 'nom', 'singular': True},
            'en': {'weak': True},
            # Mixed declension
            'es': {'mixed': True, 'case': 'nom/acc', 'gender': 'neut'},
            'er': {'mixed': True, 'case': 'nom', 'gender': 'masc'},
        }
        
        # Swiss German spelling patterns
        self.swiss_german_patterns = {
            'ss': 'ß',  # Pattern: ss in Swiss → ß in standard
            'ae': 'ä',
            'oe': 'ö', 
            'ue': 'ü',
        }
        
        # Compound word patterns (productive in German)
        self.compound_patterns = {
            # Common prefixes that form compounds
            'prefixes': ['haupt', 'neben', 'über', 'unter', 'vor', 'nach', 
                        'zwischen', 'ober', 'außen', 'innen', 'vorder', 'hinter'],
            # Common suffixes in compounds
            'suffixes': ['heit', 'keit', 'schaft', 'ung', 'tum', 'nis', 'sal', 'ling'],
            # Linking elements
            'linking': ['s', 'es', 'n', 'en', 'er', 'e'],
        }
        
        # Plural formation patterns
        self.plural_patterns = [
            # (singular_ending, plural_ending, conditions)
            ('', 'e', 'common'),           # Tag → Tage
            ('', 'er', 'neuter'),          # Kind → Kinder
            ('', 'en', 'weak'),            # Frau → Frauen
            ('', 'n', 'fem_e'),            # Blume → Blumen
            ('', 's', 'foreign'),          # Auto → Autos
            ('um', 'en', 'latin'),         # Museum → Museen
            ('us', 'en', 'latin'),         # Rhythmus → Rhythmen
            ('a', 'en', 'latin'),          # Thema → Themen
            ('o', 'i', 'italian'),         # Risiko → Risiken
        ]
    
    def get_existing_german_words(self) -> Set[str]:
        """Extract existing German words from migration"""
        files = self.validator.find_migration_files()
        german_file = [f for f in files if '901_import_german_russian_words.sql' in f][0]
        
        data = self.validator.extract_data_from_file(german_file)
        german_words = set()
        
        for id1, id2, id3, word, translation, example, example_translation in data:
            if word and word != 'word':
                normalized = self.validator.normalize_word(word, is_german=True)
                german_words.add(normalized)
                
                if '|' in word:
                    for alt in word.split('|'):
                        alt_normalized = self.validator.normalize_word(alt.strip(), is_german=True)
                        german_words.add(alt_normalized)
        
        return german_words
    
    def detect_verb_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is a verb inflection using patterns"""
        word_lower = word.lower()
        
        # Check verb ending patterns
        for ending, properties in self.verb_endings.items():
            if ending.startswith('ge'):
                # Past participle pattern
                if re.match(ending, word_lower):
                    # Try to extract stem
                    if 'ge.*t' in ending and word_lower.startswith('ge') and word_lower.endswith('t'):
                        stem = word_lower[2:-1]
                        possible_infinitives = [stem + 'en', stem + 'n']
                    elif 'ge.*en' in ending and word_lower.startswith('ge') and word_lower.endswith('en'):
                        stem = word_lower[2:-2]
                        possible_infinitives = [stem + 'en', stem + 'n']
                    else:
                        continue
                    
                    for inf in possible_infinitives:
                        if inf in existing_words:
                            return inf, f"Past participle of '{inf}'"
            elif word_lower.endswith(ending):
                stem = word_lower[:-len(ending)]
                
                # Try common infinitive formations
                possible_infinitives = []
                
                # Regular verbs
                possible_infinitives.extend([stem + 'en', stem + 'n'])
                
                # Handle stem changes for common patterns
                if len(stem) > 2:
                    # Umlaut reversals (ä→a, ö→o, ü→u)
                    if 'ä' in stem:
                        possible_infinitives.append(stem.replace('ä', 'a') + 'en')
                    if 'ö' in stem:
                        possible_infinitives.append(stem.replace('ö', 'o') + 'en')
                    if 'ü' in stem:
                        possible_infinitives.append(stem.replace('ü', 'u') + 'en')
                    
                    # Common vowel changes
                    if properties.get('tense') == 'past':
                        # Try strong verb patterns
                        for present_p, past_p, _ in self.strong_verb_patterns:
                            if re.search(past_p, stem):
                                modified_stem = re.sub(past_p, present_p, stem)
                                possible_infinitives.append(modified_stem + 'en')
                
                # Check if any possible infinitive exists
                for inf in possible_infinitives:
                    if inf in existing_words:
                        tense_info = properties.get('tense', 'conjugated')
                        person_info = f"person {properties.get('person')}" if 'person' in properties else ""
                        return inf, f"{tense_info} form of '{inf}' {person_info}".strip()
        
        # Special handling for strong verbs with stem changes
        # Try reverse stem changes for common patterns
        if len(word_lower) > 3:
            # Common present tense stem changes
            stem_changes = [
                ('ei', 'eib'),   # bleiben → bleibt
                ('ie', 'ieh'),   # sehen → sieht
                ('e', 'i'),      # geben → gibt
                ('a', 'ä'),      # fahren → fährt
                ('au', 'äu'),    # laufen → läuft
            ]
            
            for pattern, changed in stem_changes:
                if changed in word_lower:
                    possible_base = word_lower.replace(changed, pattern)
                    if possible_base + 'en' in existing_words:
                        return possible_base + 'en', f"Stem-changed form of '{possible_base}en'"
        
        return None
    
    def detect_adjective_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is an adjective declension using patterns"""
        word_lower = word.lower()
        
        # Check adjective endings
        for ending, properties in self.adj_endings.items():
            if word_lower.endswith(ending) and len(word_lower) > len(ending) + 2:
                stem = word_lower[:-len(ending)]
                
                # Possible base forms
                possible_bases = [
                    stem,           # Base form might be the stem
                    stem + 'e',     # Many adjectives end in -e
                    stem + 'er',    # Comparative forms
                    stem + 'el',    # adjectives ending in -el
                    stem + 'en',    # adjectives ending in -en
                ]
                
                # Special handling for superlatives
                if stem.endswith('st'):
                    possible_bases.append(stem[:-2])  # Remove superlative ending
                    possible_bases.append(stem[:-2] + 'e')
                
                # Check if any base form exists
                for base in possible_bases:
                    if base in existing_words:
                        declension_info = []
                        if 'case' in properties:
                            declension_info.append(properties['case'])
                        if 'gender' in properties:
                            declension_info.append(properties['gender'])
                        if properties.get('strong'):
                            declension_info.append('strong')
                        elif properties.get('weak'):
                            declension_info.append('weak')
                        
                        return base, f"Declined form of '{base}' ({', '.join(declension_info)})"
        
        return None
    
    def detect_spelling_variant(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect Swiss German or alternative spellings"""
        word_lower = word.lower()
        
        # Check Swiss German patterns
        for swiss, standard in self.swiss_german_patterns.items():
            if swiss in word_lower:
                standard_form = word_lower.replace(swiss, standard)
                if standard_form in existing_words:
                    return standard_form, f"Swiss German spelling of '{standard_form}'"
                
                # Also check if the standard form is itself an inflection
                # This catches cases like "heisst" → "heißt" → "heißen"
                verb_result = self.detect_verb_form(standard_form, existing_words)
                if verb_result:
                    base, reason = verb_result
                    return base, f"Swiss German spelling of inflected form - {reason}"
        
        # Check reverse (standard to Swiss)
        for swiss, standard in self.swiss_german_patterns.items():
            if standard in word_lower:
                swiss_form = word_lower.replace(standard, swiss)
                if swiss_form in existing_words:
                    return swiss_form, f"Standard German spelling of '{swiss_form}'"
        
        return None
    
    def detect_plural_form(self, word: str, existing_words: Set[str]) -> Optional[Tuple[str, str]]:
        """Detect if word is a plural using patterns"""
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
                    (possible_singular.replace('äu', 'au'), possible_singular),
                ]
                
                for singular, original in umlaut_reversals:
                    if singular in existing_words:
                        return singular, f"Plural of '{singular}'"
        
        return None
    
    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """Analyze word using patterns and NLP"""
        # First try spaCy
        doc = self.nlp(word)
        if not doc:
            return 'other', 'UNKNOWN', 'Could not analyze'
        
        token = doc[0]
        lemma = token.lemma_.lower()
        
        # Check if lemma exists (and is different from word)
        if lemma != word.lower() and lemma in existing_words:
            return f'inflected_{token.pos_.lower()}', token.pos_, f'Form of "{lemma}"'
        
        # Try pattern-based detection in order of priority
        
        # 1. Spelling variants FIRST (to catch heisst → heißt → heißen chain)
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
        
        # Check for essential categories with frequency
        freq = word_frequency(word.lower(), 'de')
        
        if token.pos_ in ['DET', 'PRON', 'ADP', 'PART']:
            return 'grammatical_words', token.pos_, 'Grammatical word'
        
        thresholds = {
            'VERB': 0.00005,
            'NOUN': 0.00004,
            'ADJ': 0.00005,
            'ADV': 0.00005,
            'CCONJ': 0.00005,
            'SCONJ': 0.00005,
        }
        
        if token.pos_ in thresholds and freq >= thresholds[token.pos_]:
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
        """
        Main analysis function
        
        Args:
            top_n: Number of top frequency words to analyze (default 1000)
            show_details: Whether to show detailed output
        """
        if show_details:
            print("🔍 HYBRID GERMAN WORD ANALYSIS (Pattern-Based NLP)")
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
            print("Analyzing using linguistic patterns...")
        
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
        print(f"\n✅ WORDS TO ADD (Pattern-based filtering):")
        
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
        
        print(f"\n❌ WORDS NOT TO ADD (Pattern-detected):")
        
        total_not_to_add = 0
        for cat_name, cat_display, explanation in [
            ('inflected_verbs', '🔴 VERB INFLECTIONS', 'Detected by morphological patterns'),
            ('inflected_adjectives', '🔴 ADJECTIVE DECLENSIONS', 'Detected by ending patterns'),
            ('inflected_nouns', '🔴 PLURAL FORMS', 'Detected by plural patterns'),
            ('spelling_variants', '🔴 SPELLING VARIANTS', 'Swiss German / alternative spellings'),
            ('proper_nouns', '🔴 PROPER NOUNS', 'Named entities'),
            ('grammatical_words', '🔴 GRAMMATICAL WORDS', 'Function words'),
            ('low_frequency', '🔴 LOW FREQUENCY', 'Too rare for practical use')
        ]:
            if cat_name in categories and categories[cat_name]:
                print(f"\n{cat_display} ({len(categories[cat_name])}): DON'T ADD")
                print(f"   Reason: {explanation}")
                # Show examples for pattern-detected categories
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
        print(f"   🎨 Using: Linguistic patterns + NLP (no word lists)")
        if 'other' in categories:
            print(f"   🔍 Uncategorized: {len(categories['other'])} words")
            
            # Show uncategorized words for analysis
            if categories['other'] and input("\nShow uncategorized words? (y/n): ").lower() == 'y':
                print(f"\n🔍 UNCATEGORIZED WORDS ({len(categories['other'])}):")
                for word, freq, reason, pos in sorted(categories['other'], key=lambda x: x[1], reverse=True):
                    print(f"   {word:15s} (freq: {freq:.6f}) [{pos:6s}] - {reason}")


def main():
    """Main entry point"""
    print("🚀 Initializing Hybrid German analyzer...")
    
    # Check for command line arguments
    import argparse
    parser = argparse.ArgumentParser(description='Analyze German words for LinguaQuiz')
    parser.add_argument('--top-n', type=int, default=1000, 
                       help='Number of top frequency words to analyze (default: 1000)')
    parser.add_argument('--no-details', action='store_true',
                       help='Suppress detailed output')
    args = parser.parse_args()
    
    analyzer = HybridGermanAnalyzer()
    recommendations = analyzer.analyze(top_n=args.top_n, show_details=not args.no_details)
    
    if recommendations and input("\nGenerate SQL entries? (y/n): ").lower() == 'y':
        num_entries = input(f"How many entries to generate? (max {len(recommendations)}): ")
        num_entries = int(num_entries) if num_entries.isdigit() else len(recommendations)
        print(f"\nGenerating {num_entries} SQL entries...")
        # SQL generation would go here


if __name__ == "__main__":
    main()