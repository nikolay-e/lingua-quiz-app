import re


class WordValidator:
    def __init__(self, config: dict):
        self.min_length = config.get("min_word_length", 2)
        self.max_length = config.get("max_word_length", 20)
        self.skip_words = set(config.get("skip_words", []))
        self.blacklist = config.get("blacklist", {})

        filtering = config.get("filtering", {})
        self.short_word_whitelist = set(filtering.get("short_word_whitelist", []))
        self.exclude_patterns = filtering.get("exclude_patterns", [])

    def is_valid(self, word: str, normalized: str = None) -> bool:
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
    def __init__(self, config: dict, frequency_threshold: float = 0.0):
        super().__init__(config)
        self.frequency_threshold = frequency_threshold

    def is_valid_for_analysis(self, word: str, normalized: str, frequency: float = None) -> bool:
        if not self.is_valid(word, normalized):
            return False

        if frequency is not None and frequency < self.frequency_threshold:
            return False

        return True
