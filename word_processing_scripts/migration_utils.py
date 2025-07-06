#!/usr/bin/env python3
"""
Migration Utilities for LinguaQuiz
Shared functionality for migration file processing and word normalization
"""

import os
import re
import unicodedata
import sys
from typing import List, Tuple, Dict, Set, Optional
from collections import defaultdict


def extract_data_from_file(file_path: str) -> List[Tuple[int, int, int, str, str, str, str]]:
    """
    Extract data tuples from a SQL migration file.
    Returns tuples of (word_pair_id, source_word_id, translation_id, word, translation, example, example_translation)
    """
    data = []
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except FileNotFoundError:
        print(f"❌ Error: Migration file not found at {file_path}")
        return []

    # Pattern to match data tuples: (id1, id2, id3, 'word', 'translation', 'example', 'example_translation')
    # Handle escaped quotes '' properly
    pattern = r'\(\s*(\d+),\s*(\d+),\s*(\d+),\s*\'((?:[^\']|\'\')*)\',\s*\'((?:[^\']|\'\')*)\',\s*\'((?:[^\']|\'\')*)\',\s*\'((?:[^\']|\'\')*)\'\s*\)'
    matches = re.findall(pattern, content)
    
    for match in matches:
        try:
            id1, id2, id3, word, translation, example, example_translation = match
            data.append((
                int(id1), int(id2), int(id3),
                word, translation, example, example_translation
            ))
        except ValueError:
            continue
    
    return data


def normalize_word_generic(word: str) -> str:
    """
    Generic word normalization - removes accents and lowercases.
    Use for languages other than German.
    """
    # Remove accents using Unicode normalization
    nfd_form = unicodedata.normalize('NFD', word)
    normalized = ''.join(char for char in nfd_form if unicodedata.category(char) != 'Mn')
    return normalized.lower()


def normalize_word_german(word: str) -> str:
    """
    German-specific word normalization.
    Removes articles and declension info but preserves umlauts.
    """
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


def normalize_word(word: str, is_german: bool = False) -> str:
    """
    Normalize word by removing accents and converting to lowercase.
    For German: also removes articles (der, die, das) and content after comma.
    """
    if is_german:
        return normalize_word_german(word)
    else:
        return normalize_word_generic(word)


def get_migrations_directory() -> str:
    """Get the standard migrations directory path."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    migrations_dir = os.path.join(script_dir, "..", "packages", "backend", "migrations")
    return os.path.abspath(migrations_dir)


def get_language_migration_files() -> dict:
    """Get mapping of language codes to their migration filenames."""
    return {
        'de': '901_german_russian_a1_words.sql',
        'es': '902_spanish_russian_a1_words.sql', 
        'en': '903_english_russian_a1_words.sql'
    }


def is_valid_word_for_analysis(word: str) -> bool:
    """Check if a word is valid for analysis (not digit, not too short, etc.)"""
    if word.isdigit() or len(word) <= 1:
        return False
    if word in ['°', '–', '—', '...', '«', '»', '"', '"']:
        return False
    if '.' in word and (word.startswith('www.') or '.com' in word):
        return False
    return True


def get_standard_pos_thresholds() -> Dict[str, float]:
    """Get standardized POS tag frequency thresholds for essential words."""
    return {
        'VERB': 0.00005,
        'NOUN': 0.00004,
        'ADJ': 0.00005,
        'ADV': 0.00005,
        'CCONJ': 0.00005,
        'SCONJ': 0.00005,
        'AUX': 0.00005,
    }


def get_standard_category_mapping() -> Dict[str, str]:
    """Get standardized POS to category mapping."""
    return {
        'VERB': 'essential_verbs',
        'NOUN': 'essential_nouns',
        'ADJ': 'essential_adjectives',
        'ADV': 'essential_adverbs',
        'AUX': 'essential_verbs',
        'CCONJ': 'essential_conjunctions',
        'SCONJ': 'essential_conjunctions',
    }


def get_essential_categories() -> List[str]:
    """Get list of essential word categories in display order."""
    return ['essential_verbs', 'essential_nouns', 'essential_adjectives', 'essential_adverbs', 'essential_conjunctions']


def get_ignore_categories() -> List[Tuple[str, str, str]]:
    """Get list of categories to ignore with display names and explanations."""
    return [
        ('inflected_form', '🔴 INFLECTED FORMS', 'Base form likely exists'),
        ('morphological_variant', '🔴 MORPHOLOGICAL VARIANTS', 'Alternative forms and spellings'),
        ('proper_noun', '🔴 PROPER NOUNS', 'Names of people, places, etc.'),
        ('grammatical_word', '🔴 GRAMMATICAL WORDS', 'Function words'),
        ('foreign_word', '🔴 FOREIGN WORDS', 'Not suitable for language learning'),
        ('low_frequency', '🔴 LOW FREQUENCY', 'Too rare for learners'),
        ('symbol_or_other', '🔴 SYMBOLS/OTHER', 'Non-linguistic tokens'),
        ('uncertain_lemma', '🔴 UNCERTAIN ANALYSIS', 'Multiple possible lemmas'),
        ('abbreviations', '🔴 ABBREVIATIONS', 'Likely abbreviations'),
        ('below_threshold', '🔴 BELOW THRESHOLD', 'Below frequency threshold'),
        ('other', '🔴 OTHER', 'Uncategorized'),
    ]


def load_spacy_model(language_code: str, model_preferences: List[str]):
    """Load spaCy model with fallback options."""
    import spacy
    import subprocess
    
    for model_name in model_preferences:
        try:
            nlp = spacy.load(model_name)
            print(f"✅ Loaded spaCy model: {model_name}")
            return nlp
        except OSError:
            continue
    
    # If no model found, install the last one in the list
    fallback_model = model_preferences[-1]
    print(f"📦 Installing spaCy model: {fallback_model}")
    subprocess.run([sys.executable, "-m", "spacy", "download", fallback_model])
    return spacy.load(fallback_model)


def print_analysis_header(title: str, language: str = "") -> None:
    """Print standardized analysis header."""
    full_title = f"{title} - {language.upper()}" if language else title
    print(f"\n🔍 {full_title}")
    print("=" * 80)


def print_category_results(categories: Dict, category_info: List[Tuple[str, str]], 
                          title: str, max_examples: int = None) -> int:
    """Print results for a group of categories."""
    print(f"\n{title}")
    print("=" * 80)
    
    total_count = 0
    for cat_name, cat_display in category_info:
        if cat_name in categories and categories[cat_name]:
            print(f"\n{cat_display} ({len(categories[cat_name])}):") 
            # Show all words if max_examples is None, otherwise limit
            words_to_show = categories[cat_name] if max_examples is None else categories[cat_name][:max_examples]
            for word, freq, reason, pos_tag in words_to_show:
                print(f"   ✅ {word:15s} (freq: {freq:.6f}) - {reason}")
            total_count += len(categories[cat_name])
    
    return total_count


def print_ignore_results(categories: Dict, ignore_info: List[Tuple[str, str, str]], 
                        title: str, show_examples: bool = True) -> int:
    """Print results for ignored categories."""
    print(f"\n{title}")
    print("=" * 80)
    
    total_count = 0
    for cat_name, cat_display, explanation in ignore_info:
        if cat_name in categories and categories[cat_name]:
            print(f"\n{cat_display} ({len(categories[cat_name])}):") 
            print(f"   Reason: {explanation}")
            
            if show_examples and cat_name in ['inflected_form', 'morphological_variant']:
                for word, freq, reason, pos_tag in categories[cat_name][:5]:
                    print(f"   Example: {word} - {reason}")
            total_count += len(categories[cat_name])
    
    return total_count


def print_final_recommendations(recommendations: List[Tuple[str, float, str, str]], 
                               max_display: int = None) -> None:
    """Print final recommendations in standardized format."""
    print(f"\n🎯 FINAL RECOMMENDATIONS")
    print("=" * 80)
    
    print(f"ALL {len(recommendations)} WORDS TO ADD:")
    
    for i, (word, freq, category, reason) in enumerate(recommendations, 1):
        cat_short = category.replace('essential_', '').upper()[:6]
        print(f"{i:2d}. {word:15s} (freq: {freq:.6f}) [{cat_short:6s}] - {reason}")


def print_analysis_summary(total_to_add: int, total_not_to_add: int, 
                          recommendations: List, analysis_method: str = "NLP") -> None:
    """Print standardized analysis summary."""
    print(f"\n📊 SUMMARY:")
    print(f"   ✅ Recommend adding: {total_to_add} words")
    print(f"   ❌ Don't add: {total_not_to_add} words")
    print(f"   🎯 Final recommendations: {len(recommendations)} words")
    print(f"   🔬 Analysis method: {analysis_method}")


def display_standard_results(categories: Dict, recommendations: List[Tuple[str, float, str, str]], 
                            analysis_method: str = "NLP") -> None:
    """Display results using standardized format across all analyzers."""
    
    # Essential categories to add
    essential_info = [
        ('essential_verbs', '🟢 ESSENTIAL VERBS'),
        ('essential_nouns', '🟢 ESSENTIAL NOUNS'),
        ('essential_adjectives', '🟢 ESSENTIAL ADJECTIVES'),
        ('essential_adverbs', '🟢 ESSENTIAL ADVERBS'),
        ('essential_conjunctions', '🟢 ESSENTIAL CONJUNCTIONS'),
    ]
    
    total_to_add = print_category_results(categories, essential_info, "✅ WORDS TO ADD", max_examples=None)
    total_not_to_add = print_ignore_results(categories, get_ignore_categories(), "❌ WORDS TO IGNORE")
    
    print_final_recommendations(recommendations)
    print_analysis_summary(total_to_add, total_not_to_add, recommendations, analysis_method)