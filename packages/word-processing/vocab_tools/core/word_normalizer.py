"""
Language-specific word normalization utilities.

Provides consistent word normalization across different languages,
handling language-specific characteristics like German umlauts,
Spanish accents, and English contractions.
"""

import re
import unicodedata
from typing import Set, List
from abc import ABC, abstractmethod


class WordNormalizer(ABC):
    """Base class for language-specific word normalizers."""
    
    @abstractmethod
    def normalize(self, word: str) -> str:
        """
        Normalize a word for comparison and analysis.
        
        Args:
            word: Raw word to normalize
            
        Returns:
            Normalized word
        """
        pass
    
    @abstractmethod
    def extract_word_variants(self, text: str) -> Set[str]:
        """
        Extract and normalize word variants from text (handles pipes, spaces, etc).
        
        Args:
            text: Text containing potential word variants
            
        Returns:
            Set of normalized word variants
        """
        pass
    
    def normalize_for_validation(self, word: str) -> str:
        """
        Normalize a word for duplicate validation purposes.
        
        This is more conservative than normalize() to preserve semantic distinctions
        that prevent false positive duplicates.
        
        Args:
            word: Raw word to normalize
            
        Returns:
            Normalized word preserving important distinctions
        """
        # Default implementation - remove only basic formatting
        word = word.strip()
        word = re.sub(r'\s+', ' ', word)
        return word.lower()
    
    def _remove_accents(self, text: str) -> str:
        """Remove accents and diacritical marks from text."""
        nfd = unicodedata.normalize('NFD', text)
        return ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    
    def _clean_word(self, word: str) -> str:
        """Basic word cleaning - remove parenthetical content and extra spaces."""
        # Remove parenthetical content like "(noun)", "(informal)", etc.
        word = re.sub(r'\s*\([^)]*\)', '', word)
        return word.strip()


class EnglishNormalizer(WordNormalizer):
    """Word normalizer for English text."""
    
    def normalize(self, word: str) -> str:
        """
        Normalize English words by removing accents and lowercasing.
        
        Args:
            word: English word to normalize
            
        Returns:
            Normalized English word
        """
        word = self._clean_word(word)
        word = self._remove_accents(word)
        return word.lower().strip()
    
    def extract_word_variants(self, text: str) -> Set[str]:
        """
        Extract English word variants from text.
        English typically uses pipes (|) for alternatives.
        
        Args:
            text: Text containing potential variants
            
        Returns:
            Set of normalized English word variants
        """
        variants = set()
        
        # Handle pipe-separated alternatives
        if '|' in text:
            for variant in text.split('|'):
                variants.update(self.extract_word_variants(variant.strip()))
        else:
            # Handle multi-word phrases
            if ' ' in text:
                # Add full phrase
                normalized_full = self.normalize(text)
                if normalized_full and len(normalized_full) > 1:
                    variants.add(normalized_full)
                
                # Add individual words if they're meaningful
                for part in text.split():
                    part_normalized = self.normalize(part)
                    if part_normalized and len(part_normalized) > 2:
                        variants.add(part_normalized)
            else:
                # Single word
                normalized = self.normalize(text)
                if normalized:
                    variants.add(normalized)
        
        return variants


class GermanNormalizer(WordNormalizer):
    """Word normalizer for German text."""
    
    def __init__(self):
        # German articles to remove
        self.articles = {'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einer', 'einen', 'einem', 'eines'}
    
    def normalize(self, word: str) -> str:
        """
        Normalize German words with enhanced handling for compound words and separable verbs.
        
        Args:
            word: German word to normalize
            
        Returns:
            Normalized German word
        """
        word = self._clean_word(word)
        
        # Handle comma-separated parts (take first part)
        if ',' in word:
            word = word.split(',')[0].strip()
        
        # Remove articles from the beginning
        parts = word.lower().split()
        if parts and parts[0] in self.articles:
            word = ' '.join(parts[1:]) if len(parts) > 1 else word
        
        # Enhanced normalization for better accuracy
        # Remove hyphens from compound words
        word = word.replace('-', '')
        
        # Handle basic separable verb prefix patterns (e.g., "rufe an" -> "anrufen")
        separable_prefixes = {"an", "auf", "aus", "ein", "mit", "vor", "zu", "ab", "bei", "nach"}
        if ' ' in word:
            parts = word.split(' ', 1)
            if len(parts) == 2 and parts[1] in separable_prefixes:
                word = parts[1] + parts[0]  # Combine prefix with verb
        
        # Convert to lowercase but preserve umlauts
        word = word.lower().strip()
        
        return word
    
    def extract_word_variants(self, text: str) -> Set[str]:
        """
        Extract German word variants with special handling for compound words
        and comma-separated alternatives.
        
        Args:
            text: Text containing potential German variants
            
        Returns:
            Set of normalized German word variants
        """
        variants = set()
        
        # Handle pipe-separated alternatives  
        if '|' in text:
            for variant in text.split('|'):
                variants.update(self.extract_word_variants(variant.strip()))
        else:
            # Handle comma-separated alternatives (common in German)
            if ',' in text and not text.count(',') > 2:  # Avoid sentences
                for variant in text.split(','):
                    variant = variant.strip()
                    if variant:
                        normalized = self.normalize(variant)
                        if normalized and len(normalized) > 2:
                            variants.add(normalized)
            else:
                # Single word or phrase
                normalized = self.normalize(text)
                if normalized:
                    variants.add(normalized)
        
        return variants
    
    def normalize_for_validation(self, word: str) -> str:
        """
        German validation normalization that preserves case-sensitive pronouns.
        
        Preserves case distinctions for:
        - Sie (formal you) vs sie (they/she)
        - Ihr (formal your) vs ihr (their/her)
        
        Args:
            word: German word to normalize
            
        Returns:
            Normalized word preserving case-sensitive pronouns
        """
        word = self._clean_word(word)
        
        # Preserve case for pronouns that change meaning with capitalization
        case_sensitive_pronouns = {'Sie', 'sie', 'Ihr', 'ihr'}
        if word in case_sensitive_pronouns:
            return word  # Keep original case
        
        # For other words, apply basic normalization
        word = word.strip()
        word = re.sub(r'\s+', ' ', word)
        return word.lower()


class SpanishNormalizer(WordNormalizer):
    """Word normalizer for Spanish text."""
    
    def normalize(self, word: str) -> str:
        """
        Normalize Spanish words with enhanced handling for diminutives and common patterns.
        
        Preserves ALL accents and ñ (they change meaning):
        - "si" (if) vs "sí" (yes) - different words
        - "soñar" (to dream) vs "sonar" (to sound) - different words  
        - "año" (year) vs "ano" (anus) - very different words!
        
        Args:
            word: Spanish word to normalize
            
        Returns:
            Normalized Spanish word with ALL diacritics preserved
        """
        word = self._clean_word(word)
        original = word.lower().strip()
        
        # Enhanced normalization: handle common diminutive suffixes
        # This helps match "gatito" to "gato", "casita" to "casa", etc.
        diminutive_patterns = [
            ('ito', ''), ('ita', ''), ('itos', 's'), ('itas', 's'),
            ('ico', ''), ('ica', ''), ('icos', 's'), ('icas', 's'),
            ('illo', ''), ('illa', ''), ('illos', 's'), ('illas', 's')
        ]
        
        # Only apply diminutive normalization if the word is long enough
        if len(original) > 5:
            for suffix, replacement in diminutive_patterns:
                if original.endswith(suffix):
                    base = original[:-len(suffix)] + replacement
                    # Ensure the base form makes sense (has vowels)
                    if any(c in base for c in 'aeiouáéíóúü'):
                        return base
        
        return original
    
    def extract_word_variants(self, text: str) -> Set[str]:
        """
        Extract Spanish word variants from text.
        
        Args:
            text: Text containing potential Spanish variants
            
        Returns:
            Set of normalized Spanish word variants
        """
        variants = set()
        
        # Handle pipe-separated alternatives
        if '|' in text:
            for variant in text.split('|'):
                variants.update(self.extract_word_variants(variant.strip()))
        else:
            # Handle multi-word phrases
            if ' ' in text:
                # Add full phrase
                normalized_full = self.normalize(text)
                if normalized_full and len(normalized_full) > 1:
                    variants.add(normalized_full)
                
                # Add individual meaningful words
                for part in text.split():
                    part_normalized = self.normalize(part)
                    if part_normalized and len(part_normalized) > 2:
                        variants.add(part_normalized)
            else:
                # Single word
                normalized = self.normalize(text)
                if normalized:
                    variants.add(normalized)
        
        return variants


# Factory function to get appropriate normalizer
def get_normalizer(language_code: str) -> WordNormalizer:
    """
    Get the appropriate word normalizer for a language.
    
    Args:
        language_code: ISO language code (en, de, es)
        
    Returns:
        Language-specific word normalizer
        
    Raises:
        ValueError: If language code is not supported
    """
    normalizers = {
        'en': EnglishNormalizer,
        'de': GermanNormalizer, 
        'es': SpanishNormalizer,
    }
    
    if language_code not in normalizers:
        raise ValueError(f"Unsupported language code: {language_code}")
    
    return normalizers[language_code]()