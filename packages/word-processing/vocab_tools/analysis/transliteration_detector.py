from difflib import SequenceMatcher


class TransliterationDetector:
    ES_TO_CY = {
        "a": "а",
        "b": "б",
        "v": "в",
        "g": "г",
        "d": "д",
        "e": "е",
        "z": "з",
        "i": "и",
        "k": "к",
        "l": "л",
        "m": "м",
        "n": "н",
        "o": "о",
        "p": "п",
        "r": "р",
        "s": "с",
        "t": "т",
        "u": "у",
        "f": "ф",
        "h": "х",
        "c": "к",
        "y": "и",
        "j": "х",
        "ch": "ч",
        "sh": "ш",
        "zh": "ж",
        "ts": "ц",
        "ya": "я",
        "yu": "ю",
    }

    CY_TO_ES = {v: k for k, v in ES_TO_CY.items()}

    def __init__(self, similarity_threshold: float = 0.7):
        self.similarity_threshold = similarity_threshold

    def transliterate_to_cyrillic(self, text: str) -> str:
        text = text.lower()
        result = []
        i = 0

        while i < len(text):
            if i < len(text) - 1:
                two_char = text[i : i + 2]
                if two_char in self.ES_TO_CY:
                    result.append(self.ES_TO_CY[two_char])
                    i += 2
                    continue

            char = text[i]
            result.append(self.ES_TO_CY.get(char, char))
            i += 1

        return "".join(result)

    def transliterate_to_latin(self, text: str) -> str:
        text = text.lower()
        return "".join(self.CY_TO_ES.get(char, char) for char in text)

    def calculate_similarity(self, str1: str, str2: str) -> float:
        return SequenceMatcher(None, str1.lower(), str2.lower()).ratio()

    def is_transliteration(self, source_word: str, target_word: str, source_lang: str = "es", target_lang: str = "ru") -> tuple[bool, float]:
        source_word = source_word.lower().strip()
        target_word = target_word.lower().strip()

        if not source_word or not target_word:
            return False, 0.0

        if len(source_word) < 3 or len(target_word) < 3:
            return False, 0.0

        if source_lang == "es" and target_lang == "ru":
            transliterated = self.transliterate_to_cyrillic(source_word)
        elif source_lang == "ru" and target_lang == "es":
            transliterated = self.transliterate_to_latin(source_word)
        else:
            return False, 0.0

        similarity = self.calculate_similarity(transliterated, target_word)

        is_match = similarity >= self.similarity_threshold

        return is_match, similarity

    def find_transliterations(self, word_pairs: list[tuple[str, str]], source_lang: str = "es", target_lang: str = "ru") -> list[dict]:
        matches = []

        for source_word, target_word in word_pairs:
            is_trans, similarity = self.is_transliteration(source_word, target_word, source_lang, target_lang)

            if is_trans:
                matches.append(
                    {
                        "source_word": source_word,
                        "target_word": target_word,
                        "similarity": similarity,
                        "recommendation": "MOVE_TO_A0",
                    }
                )

        return matches
