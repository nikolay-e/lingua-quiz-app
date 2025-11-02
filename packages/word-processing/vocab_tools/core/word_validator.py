"""
Word validation utilities for vocabulary processing.

Provides unified word validation logic across all vocabulary analysis components,
eliminating duplication between VocabularyProcessor, VocabularyAnalyzer, and
WordQualityValidator.
"""

import re


class WordValidator:
    """
    Validates words based on configurable rules.

    Provides consistent word validation and rejection reason generation
    across all components that process vocabulary data.
    """

    def __init__(self, config: dict):
        """
        Initialize word validator with configuration.

        Args:
            config: Language configuration dictionary containing:
                - min_word_length: Minimum word length (default: 2)
                - max_word_length: Maximum word length (default: 20)
                - skip_words: Set of words to skip
                - blacklist: Dictionary of blacklist categories to word lists
                - filtering: Dictionary with exclude_patterns, short_word_whitelist
        """
        self.min_length = config.get("min_word_length", 2)
        self.max_length = config.get("max_word_length", 20)
        self.skip_words = set(config.get("skip_words", []))
        self.blacklist = config.get("blacklist", {})

        filtering = config.get("filtering", {})
        self.short_word_whitelist = set(filtering.get("short_word_whitelist", []))
        self.exclude_patterns = filtering.get("exclude_patterns", [])

    def is_valid(self, word: str, normalized: str = None) -> bool:
        """
        Check if word is valid according to configured rules.

        Args:
            word: Original word to validate
            normalized: Normalized form of the word (optional)

        Returns:
            True if word passes all validation rules, False otherwise
        """
        if normalized is None:
            normalized = word.lower()

        if not word or not word.strip():
            return False

        if word.isdigit():
            return False

        if len(word) > self.max_length:
            return False

        if len(word) < self.min_length and word.lower() not in self.short_word_whitelist:
            return False

        if normalized in self.skip_words:
            return False

        for _category, words_list in self.blacklist.items():
            if word.lower() in words_list or normalized in words_list:
                return False

        return all(not re.match(pattern, word) for pattern in self.exclude_patterns)

    def get_rejection_reason(self, word: str, normalized: str = None) -> tuple[str, str]:
        """
        Get category and reason for why word was rejected.

        Args:
            word: Original word
            normalized: Normalized form of the word (optional)

        Returns:
            Tuple of (category, reason) explaining rejection
        """
        if normalized is None:
            normalized = word.lower()

        if not word or not word.strip():
            return ("empty", "Empty word")

        if word.isdigit():
            return ("numeric", "Pure number")

        if len(word) > self.max_length:
            return ("length", f"Exceeds maximum length ({self.max_length} chars)")

        if len(word) < self.min_length and word.lower() not in self.short_word_whitelist:
            return ("length", f"Too short (min: {self.min_length} chars)")

        if normalized in self.skip_words:
            return ("skip_list", "In skip words list")

        for category, words_list in self.blacklist.items():
            if word.lower() in words_list or normalized in words_list:
                return ("blacklist", f"In blacklist category: {category}")

        for pattern in self.exclude_patterns:
            if re.match(pattern, word):
                return ("pattern", f"Matches exclusion pattern: {pattern}")

        return ("unknown", "Rejected by filters")


class VocabularyAnalysisValidator(WordValidator):
    """
    Extended validator for vocabulary analysis with frequency threshold.

    Adds frequency-based filtering on top of basic word validation.
    """

    def __init__(self, config: dict, frequency_threshold: float = 0.0):
        """
        Initialize analysis validator.

        Args:
            config: Language configuration dictionary
            frequency_threshold: Minimum frequency threshold for words
        """
        super().__init__(config)
        self.frequency_threshold = frequency_threshold

    def is_valid_for_analysis(self, word: str, normalized: str, frequency: float = None) -> bool:
        """
        Check if word is valid for vocabulary analysis.

        Args:
            word: Original word
            normalized: Normalized form
            frequency: Word frequency (optional)

        Returns:
            True if word passes validation and frequency threshold
        """
        if not self.is_valid(word, normalized):
            return False

        if frequency is not None and frequency < self.frequency_threshold:
            return False

        return True
