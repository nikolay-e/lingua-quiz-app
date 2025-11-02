import re
import unicodedata


class UniversalNormalizer:
    def __init__(self, language_config: dict):
        self.preserve_diacritics = language_config.get("preserve_diacritics", False)
        self.articles = set(language_config.get("articles", []))
        self.remove_hyphens = language_config.get("remove_hyphens", False)
        self.comma_separator = language_config.get("comma_separator", False)
        self.special_chars = language_config.get("special_chars", [])

    def normalize(self, word: str) -> str:
        word = self._clean_word(word)

        if "," in word and not self.comma_separator:
            word = word.split(",")[0].strip()

        if not self.preserve_diacritics:
            word = self._remove_accents(word)

        word = word.lower()

        if self.articles:
            parts = word.split()
            if parts and parts[0] in self.articles:
                word = " ".join(parts[1:]) if len(parts) > 1 else word

        if self.remove_hyphens:
            word = word.replace("-", "")

        return word.strip()

    def extract_word_variants(self, text: str) -> set[str]:
        variants = set()

        if "|" in text:
            for variant in text.split("|"):
                variants.update(self.extract_word_variants(variant.strip()))
        elif "," in text and self.comma_separator and text.count(",") <= 2:
            for variant in text.split(","):
                variant = variant.strip()
                if variant:
                    normalized = self.normalize(variant)
                    if normalized and len(normalized) > 2:
                        variants.add(normalized)
        elif " " in text:
            normalized_full = self.normalize(text)
            if normalized_full and len(normalized_full) > 1:
                variants.add(normalized_full)

            for part in text.split():
                part_normalized = self.normalize(part)
                if part_normalized and len(part_normalized) > 2:
                    variants.add(part_normalized)
        else:
            normalized = self.normalize(text)
            if normalized:
                variants.add(normalized)

        return variants

    def _clean_word(self, word: str) -> str:
        word = re.sub(r"\s*\[.*?\]", "", word)
        return word.strip()

    def _remove_accents(self, text: str) -> str:
        nfd = unicodedata.normalize("NFD", text)
        base = "".join(c for c in nfd if unicodedata.category(c) != "Mn")

        for special_char in self.special_chars:
            if special_char in text:
                base = base.replace(self._remove_accents_single(special_char), special_char)

        return base

    def _remove_accents_single(self, char: str) -> str:
        nfd = unicodedata.normalize("NFD", char)
        return "".join(c for c in nfd if unicodedata.category(c) != "Mn")


def get_universal_normalizer(language_code: str, config_loader) -> UniversalNormalizer:
    language_config = config_loader.get_language_config(language_code)
    normalization_config = language_config.get("normalization", {})
    return UniversalNormalizer(normalization_config)
