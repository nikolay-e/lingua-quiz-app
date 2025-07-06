#!/usr/bin/env python3
"""
Base Word Analyzer for LinguaQuiz
Common functionality shared across language analyzers
"""

import argparse
from typing import Dict, List, Tuple, Set, Optional
from collections import defaultdict
from wordfreq import word_frequency, top_n_list
from abc import ABC, abstractmethod
from migration_utils import (
    extract_data_from_file, get_migrations_directory, is_valid_word_for_analysis,
    get_standard_pos_thresholds, get_standard_category_mapping, get_essential_categories,
    display_standard_results, print_analysis_header
)

class BaseWordAnalyzer(ABC):
    """
    Base class for language-specific word analyzers.
    Provides common functionality for file handling, argument parsing, and basic analysis.
    """
    
    def __init__(self, migrations_dir: Optional[str] = None, language_code: str = "en"):
        """Initialize the base analyzer."""
        self.language_code = language_code
        
        if migrations_dir is None:
            migrations_dir = get_migrations_directory()
        self.migrations_dir = migrations_dir
        
        # Use standardized thresholds and mappings
        self.pos_thresholds = get_standard_pos_thresholds()
        self.category_mapping = get_standard_category_mapping()
    
    def extract_data_from_file(self, file_path: str) -> List[Tuple]:
        """
        Extracts data tuples from a SQL migration file.
        Returns tuples of (id1, id2, id3, word, translation, example, example_translation)
        """
        return extract_data_from_file(file_path)
    
    def get_top_words(self, top_n: int = 1000) -> List[str]:
        """Get top N words for the language, filtered for validity."""
        raw_words = top_n_list(self.language_code, top_n)
        return [w for w in raw_words if self.is_valid_word(w)]
    
    def is_valid_word(self, word: str) -> bool:
        """Check if a word is valid for analysis (not digit, not too short, etc.)"""
        return is_valid_word_for_analysis(word)
    
    def process_word_variants(self, word: str, skip_words: Optional[Set[str]] = None) -> Set[str]:
        """
        Process word variants (pipe-separated, spaces) and return normalized forms.
        Common logic for all analyzers to handle word extraction consistently.
        """
        if skip_words is None:
            skip_words = set()
            
        words = set()
        
        # Handle pipe-separated alternatives
        if '|' in word:
            for alt in word.split('|'):
                words.update(self.process_word_variants(alt.strip(), skip_words))
        else:
            # Handle spaces in phrases
            if ' ' in word:
                # Add the full normalized phrase
                normalized_full = self.normalize_word(word)
                if normalized_full not in skip_words:
                    words.add(normalized_full)
                
                # Extract individual meaningful words
                for part in word.split():
                    part_normalized = self.normalize_word(part.strip())
                    if (part_normalized not in skip_words and 
                        len(part_normalized) > 2 and 
                        part_normalized):
                        words.add(part_normalized)
            else:
                # Single word
                normalized = self.normalize_word(word)
                if normalized not in skip_words:
                    words.add(normalized)
        
        return words
    
    def setup_argument_parser(self, description: str) -> argparse.ArgumentParser:
        """Setup common command line arguments."""
        parser = argparse.ArgumentParser(description=description)
        
        parser.add_argument('--top-n', type=int, default=1000, 
                           help='Number of top frequency words to analyze (default: 1000)')
        parser.add_argument('--hide-details', action='store_true',
                           help='Suppress the detailed category-by-category report output.')
        parser.add_argument('--migrations-dir', type=str, default=None,
                           help='Path to the migrations directory. Defaults to a relative path.')
        parser.add_argument('--limit-analysis', type=int, default=None,
                           help='Limit analysis to first N words (default: analyze all)')
        
        return parser
    
    def print_analysis_header(self, title: str):
        """Print a formatted analysis header."""
        print_analysis_header(title, self.language_code)
    
    
    @abstractmethod
    def normalize_word(self, word: str) -> str:
        """Normalize a word for comparison. Language-specific implementation required."""
        pass
    
    @abstractmethod
    def get_existing_words(self) -> Set[str]:
        """Get existing words from migration file. Language-specific implementation required."""
        pass
    
    @abstractmethod
    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """Analyze a single word. Language-specific implementation required."""
        pass
    
    @abstractmethod
    def get_migration_filename(self) -> str:
        """Get the migration filename for this language."""
        pass
    
    def run_main(self, description: str):
        """Common main entry point for all analyzers."""
        parser = self.setup_argument_parser(description)
        args = parser.parse_args()
        
        # Update migrations_dir if provided via args
        if args.migrations_dir:
            self.migrations_dir = args.migrations_dir
        
        recommendations = self.analyze(
            top_n=args.top_n, 
            show_details=not args.hide_details,
            limit_analysis=getattr(args, 'limit_analysis', None)
        )
        
        if recommendations:
            lang_name = self.language_code.upper()
            print(f"\n🎉 Analysis complete. Found {len(recommendations)} potential new {lang_name} words to add.")
        
        return recommendations
    
    def analyze(self, top_n: int = 1000, show_details: bool = True, limit_analysis: Optional[int] = None) -> List[Tuple[str, float, str, str]]:
        """
        Main analysis function. Can be overridden for language-specific behavior.
        """
        if show_details:
            self.print_analysis_header(f"{self.language_code.upper()} WORD ANALYSIS")
        
        existing_words = self.get_existing_words()
        if show_details:
            print(f"Found {len(existing_words)} existing words in the database.")
        
        top_words = self.get_top_words(top_n)
        missing_words = [word for word in top_words if self.normalize_word(word) not in existing_words]
        
        if show_details:
            print(f"Found {len(missing_words)} missing words from the top {top_n} most frequent.")
            if limit_analysis and limit_analysis < len(missing_words):
                print(f"⚠️  Limiting analysis to first {limit_analysis} words")
            print("Analyzing missing words...")
        
        # Apply optional limit
        words_to_analyze = missing_words[:limit_analysis] if limit_analysis else missing_words
        
        categories = defaultdict(list)
        for word in words_to_analyze:
            category, pos_tag, reason = self.analyze_word(word, existing_words)
            freq = word_frequency(word.lower(), self.language_code)
            categories[category].append((word, freq, reason, pos_tag))
        
        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x[1], reverse=True)
            
        # Generate recommendations
        recommendations = []
        essential_categories = get_essential_categories()
        for category in essential_categories:
            if category in categories:
                for word, freq, reason, pos_tag in categories[category]:
                    recommendations.append((word, freq, category, f"{reason} [{pos_tag}]"))
        
        recommendations.sort(key=lambda x: x[1], reverse=True)
        
        if show_details:
            self._display_results(dict(categories), recommendations)
            
        return recommendations
    
    def _display_results(self, categories: Dict, recommendations: List):
        """Display analysis results using standardized format."""
        display_standard_results(categories, recommendations, "NLP")