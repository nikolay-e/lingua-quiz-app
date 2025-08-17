"""
Base vocabulary analyzer for language learning applications.

Provides the foundation for analyzing vocabulary gaps and recommending
new words based on frequency analysis and NLP classification.
"""

import argparse
from pathlib import Path
from typing import Dict, List, Tuple, Set, Optional, Any
from collections import defaultdict
from abc import ABC, abstractmethod
from dataclasses import dataclass

from wordfreq import word_frequency, top_n_list

from .database_parser import DatabaseParser, VocabularyEntry
from .word_normalizer import WordNormalizer, get_normalizer
from .nlp_models import get_nlp_model
from ..config.constants import (
    POS_ANALYSIS_THRESHOLDS,
    WORD_CATEGORY_MAPPING,
    ESSENTIAL_VOCABULARY_CATEGORIES,
    ANALYSIS_SKIP_WORDS,
    DEFAULT_ANALYSIS_CONFIG
)


@dataclass
class WordAnalysis:
    """Results of analyzing a single word."""
    word: str
    frequency: float
    category: str
    pos_tag: str
    reason: str
    is_recommended: bool = False


@dataclass
class VocabularyAnalysisResult:
    """Complete results of vocabulary analysis."""
    language_code: str
    total_existing_words: int
    total_analyzed_words: int
    recommendations: List[WordAnalysis]
    categories: Dict[str, List[WordAnalysis]]
    
    def get_recommendation_count(self) -> int:
        """Get the number of recommended words."""
        return len(self.recommendations)
    
    def get_category_summary(self) -> Dict[str, int]:
        """Get word counts by category."""
        return {category: len(words) for category, words in self.categories.items()}
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'language_code': self.language_code,
            'total_existing_words': self.total_existing_words,
            'total_analyzed_words': self.total_analyzed_words,
            'recommendation_count': self.get_recommendation_count(),
            'category_summary': self.get_category_summary(),
            'recommendations': [
                {
                    'word': r.word,
                    'frequency': r.frequency,
                    'category': r.category,
                    'pos_tag': r.pos_tag,
                    'reason': r.reason
                }
                for r in self.recommendations
            ]
        }


class VocabularyAnalyzer(ABC):
    """
    Base class for language-specific vocabulary analyzers.
    
    Provides common functionality for analyzing vocabulary gaps
    and generating learning recommendations.
    """
    
    def __init__(
        self,
        language_code: str,
        migrations_directory: Optional[Path] = None,
        config: Optional[Dict[str, Any]] = None,
        silent: bool = False
    ):
        """
        Initialize the vocabulary analyzer.
        
        Args:
            language_code: ISO language code (en, de, es)
            migrations_directory: Path to migrations directory
            config: Analysis configuration parameters
        """
        self.language_code = language_code
        self.config = {**DEFAULT_ANALYSIS_CONFIG, **(config or {})}
        self.silent = silent
        
        # Initialize components
        self.db_parser = DatabaseParser(migrations_directory)
        self.normalizer = get_normalizer(language_code)
        self._nlp_model: Optional[Any] = None
        
        # Supported languages
        supported_languages = ['en', 'de', 'es']
        if language_code not in supported_languages:
            raise ValueError(f"Unsupported language: {language_code}")
    
    @property
    def nlp_model(self) -> Any:
        """Lazy-load the NLP model."""
        if self._nlp_model is None:
            self._nlp_model = self.load_nlp_model(silent=self.silent)
        return self._nlp_model
    
    @abstractmethod
    def load_nlp_model(self, silent: bool = False) -> Any:
        """
        Load the appropriate NLP model for this language.
        
        Args:
            silent: If True, suppress loading messages
        
        Returns:
            Loaded spaCy NLP model
        """
        pass
    
    @abstractmethod
    def analyze_word_linguistics(self, word: str, existing_words: Set[str], rank: int = None) -> Tuple[str, str, str]:
        """
        Perform language-specific linguistic analysis of a word.
        
        Args:
            word: Word to analyze
            existing_words: Set of existing vocabulary words
            rank: Frequency rank of the word (1-based)
            
        Returns:
            Tuple of (category, pos_tag, analysis_reason)
        """
        pass
    
    def get_migration_filename(self) -> str:
        """Get the migration filename for this language."""
        # Dynamic discovery
        discovered_files = self.db_parser.discover_migration_files()
        if self.language_code in discovered_files:
            # Return the first file for this language (they're sorted)
            return discovered_files[self.language_code][0]
        
        raise FileNotFoundError(f"No migration file found for language '{self.language_code}'")
    
    def extract_existing_vocabulary(self) -> Set[str]:
        """
        Extract existing vocabulary from the migration file.
        
        Returns:
            Set of normalized existing words
        """
        migration_file = self.get_migration_filename()
        
        try:
            entries = self.db_parser.parse_migration_file(migration_file)
        except FileNotFoundError:
            print(f"⚠️  Migration file not found: {migration_file}")
            return set()
        
        existing_words = set()
        
        for entry in entries:
            if self._is_valid_vocabulary_entry(entry):
                # Extract word variants using language-specific normalizer
                word_variants = self.normalizer.extract_word_variants(entry.source_word)
                existing_words.update(word_variants)
        
        return existing_words
    
    def _is_valid_vocabulary_entry(self, entry: VocabularyEntry) -> bool:
        """
        Check if a vocabulary entry is valid for analysis.
        
        Args:
            entry: Vocabulary entry to validate
            
        Returns:
            True if entry is valid for analysis
        """
        # Skip obvious placeholder entries
        if (entry.source_word == 'word' and entry.target_word == 'translation'):
            return False
        
        # Skip empty entries
        if not entry.source_word.strip():
            return False
        
        return True
    
    def get_frequent_missing_words(self, top_n: int = 1000, start_rank: int = 1) -> List[str]:
        """
        Get most frequent words that are missing from vocabulary within a frequency range.
        
        Args:
            top_n: Number of top frequent words to consider (end of range)
            start_rank: Starting rank for frequency range (1-based, default: 1)
            
        Returns:
            List of missing words sorted by frequency within the specified range
        """
        existing_words = self.extract_existing_vocabulary()
        
        # Get top frequent words for this language
        all_frequent_words = top_n_list(self.language_code, top_n)
        
        # Extract words within the specified frequency range
        # Convert to 0-based indexing for slicing
        start_idx = start_rank - 1
        frequent_words = all_frequent_words[start_idx:]
        
        # Filter to valid words not in existing vocabulary
        missing_words = []
        for word in frequent_words:
            if (self._is_word_valid_for_analysis(word) and
                self.normalizer.normalize(word) not in existing_words):
                missing_words.append(word)
        
        return missing_words
    
    def _is_word_valid_for_analysis(self, word: str) -> bool:
        """
        Check if a word is valid for analysis.
        
        Args:
            word: Word to validate
            
        Returns:
            True if word should be analyzed
        """
        if not word or len(word) < self.config['min_word_length']:
            return False
        
        if len(word) > self.config['max_word_length']:
            return False
        
        if word.isdigit():
            return False
        
        # Check against skip words
        normalized_word = self.normalizer.normalize(word)
        if normalized_word in ANALYSIS_SKIP_WORDS:
            return False
        
        # Check frequency threshold
        freq = word_frequency(word, self.language_code)
        if freq < self.config['frequency_threshold']:
            return False
        
        return True
    
    def analyze_vocabulary_gaps(
        self,
        top_n: int = 1000,
        start_rank: int = 1,
        limit_analysis: Optional[int] = None,
        show_progress: bool = True
    ) -> VocabularyAnalysisResult:
        """
        Analyze vocabulary gaps and generate recommendations.
        
        Args:
            top_n: Number of top frequent words to analyze (end of range)
            start_rank: Starting rank for frequency analysis (1-based)
            limit_analysis: Limit analysis to first N missing words
            show_progress: Whether to show progress information
            
        Returns:
            Complete analysis results
        """
        if show_progress:
            print(f"🔍 Analyzing {self.language_code.upper()} vocabulary gaps...")
        
        # Extract existing vocabulary
        existing_words = self.extract_existing_vocabulary()
        if show_progress:
            print(f"📊 Found {len(existing_words)} existing words")
        
        # Get missing words to analyze within the specified frequency range
        missing_words = self.get_frequent_missing_words(top_n, start_rank)
        if limit_analysis and limit_analysis < len(missing_words):
            missing_words = missing_words[:limit_analysis]
            if show_progress:
                print(f"⚠️  Limited analysis to first {limit_analysis} words")
        
        if show_progress:
            print(f"🎯 Analyzing {len(missing_words)} missing words...")
        
        # Analyze each missing word with lemma prioritization
        categories = defaultdict(list)
        all_analyses = []
        analyzed_lemmas = set()  # Track lemmas we've already processed
        
        for rank, word in enumerate(missing_words, start=start_rank):
            try:
                # Get lemma for this word
                doc = self.nlp_model(word)
                if not doc:
                    continue
                    
                token = doc[0]
                lemma = token.lemma_.lower()
                
                # Skip if we've already processed this lemma
                if lemma in analyzed_lemmas:
                    continue
                    
                # Check if the LEMMA is in the database
                normalized_lemma = self.normalizer.normalize(lemma)
                if normalized_lemma in existing_words:
                    continue
                
                # Analyze the lemma if it's valid
                if not self._is_word_valid_for_analysis(lemma):
                    continue
                    
                category, pos_tag, reason = self.analyze_word_linguistics(lemma, existing_words, rank=rank)
                frequency = word_frequency(lemma, self.language_code)
                
                analysis = WordAnalysis(
                    word=lemma,  # Use lemma instead of original word
                    frequency=frequency,
                    category=category,
                    pos_tag=pos_tag,
                    reason=reason,
                    is_recommended=(category in ESSENTIAL_VOCABULARY_CATEGORIES)
                )
                
                categories[category].append(analysis)
                all_analyses.append(analysis)
                analyzed_lemmas.add(lemma)  # Mark as processed
                
            except Exception as e:
                if show_progress:
                    print(f"⚠️  Error analyzing '{word}': {e}")
                continue
        
        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x.frequency, reverse=True)
        
        # Generate recommendations (essential categories only)
        recommendations = []
        for category in ESSENTIAL_VOCABULARY_CATEGORIES:
            if category in categories:
                recommendations.extend(categories[category])
        
        recommendations.sort(key=lambda x: x.frequency, reverse=True)
        
        return VocabularyAnalysisResult(
            language_code=self.language_code,
            total_existing_words=len(existing_words),
            total_analyzed_words=len(all_analyses),
            recommendations=recommendations,
            categories=dict(categories)
        )
    
    def print_analysis_results(self, result: VocabularyAnalysisResult, show_details: bool = True):
        """
        Print formatted analysis results.
        
        Args:
            result: Analysis results to print
            show_details: Whether to show detailed category breakdown
        """
        print(f"\n{'='*80}")
        print(f"📊 {result.language_code.upper()} VOCABULARY ANALYSIS RESULTS")
        print(f"{'='*80}")
        
        print(f"📈 Summary:")
        print(f"   • Existing vocabulary: {result.total_existing_words:,} words")
        print(f"   • Words analyzed: {result.total_analyzed_words:,} words")
        print(f"   • Recommendations: {result.get_recommendation_count():,} words")
        
        if show_details and result.categories:
            print(f"\n📋 Category Breakdown:")
            category_summary = result.get_category_summary()
            for category, count in category_summary.items():
                print(f"   • {category}: {count:,} words")
        
        if result.recommendations:
            print(f"\n🎯 Top Recommendations (by frequency):")
            for i, analysis in enumerate(result.recommendations[:20], 1):
                print(f"   {i:2d}. {analysis.word:<15} ({analysis.frequency:.2e}) - {analysis.reason}")
        
        print(f"\n{'='*80}")
    
    def setup_cli_parser(self, description: str) -> argparse.ArgumentParser:
        """
        Set up command-line argument parser.
        
        Args:
            description: Description for the CLI tool
            
        Returns:
            Configured argument parser
        """
        parser = argparse.ArgumentParser(description=description)
        
        parser.add_argument(
            '--top-n', type=int, default=1000,
            help='Number of top frequency words to analyze (default: 1000)'
        )
        parser.add_argument(
            '--limit-analysis', type=int, default=None,
            help='Limit analysis to first N words (default: analyze all)'
        )
        parser.add_argument(
            '--hide-details', action='store_true',
            help='Hide detailed category breakdown'
        )
        parser.add_argument(
            '--migrations-dir', type=str, default=None,
            help='Path to migrations directory (default: auto-detect)'
        )
        parser.add_argument(
            '--output-format', choices=['text', 'json'], default='text',
            help='Output format (default: text)'
        )
        
        return parser