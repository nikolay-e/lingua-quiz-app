from collections import defaultdict
from dataclasses import dataclass
from typing import Literal

try:
    from nltk.collocations import BigramCollocationFinder
    from nltk.metrics import BigramAssocMeasures

    NLTK_AVAILABLE = True
except ImportError:
    NLTK_AVAILABLE = False

from wordfreq import zipf_frequency

CollocationTypeType = Literal["bigram", "trigram"]


@dataclass
class Collocation:
    words: tuple[str, ...]
    collocation_type: CollocationTypeType
    score: float
    frequency: int
    cefr_level: str | None = None
    example_sentence: str | None = None
    dependency_validated: bool = False


class CollocationExtractor:
    def __init__(self, nlp_model, language_code: str):
        self.nlp = nlp_model
        self.language_code = language_code

        if not NLTK_AVAILABLE:
            print("⚠️  NLTK not available. Install with: pip install nltk")

    def extract_from_corpus(
        self, texts: list[str], min_freq: int = 5, top_n: int = 100, validate: bool = True
    ) -> list[Collocation]:
        if not NLTK_AVAILABLE:
            return []

        tokens = []
        for text in texts:
            doc = self.nlp(text)
            tokens.extend([token.text.lower() for token in doc if token.is_alpha])

        bigrams = self._extract_bigrams(tokens, min_freq, top_n * 3)

        if validate:
            bigrams = self._validate_with_dependencies(bigrams, texts)

        return bigrams[:top_n]

    def _extract_bigrams(self, tokens: list[str], min_freq: int, top_n: int) -> list[Collocation]:
        finder = BigramCollocationFinder.from_words(tokens)
        finder.apply_freq_filter(min_freq)

        scored = finder.score_ngrams(BigramAssocMeasures.likelihood_ratio)

        collocations = []
        for (word1, word2), score in scored[:top_n]:
            freq = finder.ngram_fd[(word1, word2)]
            cefr_level = self._assign_cefr_level(word1, word2)

            collocation = Collocation(
                words=(word1, word2),
                collocation_type="bigram",
                score=score,
                frequency=freq,
                cefr_level=cefr_level,
                dependency_validated=False,
            )
            collocations.append(collocation)

        return collocations

    def _validate_with_dependencies(self, collocations: list[Collocation], texts: list[str]) -> list[Collocation]:
        valid_deps = {
            "nsubj",
            "obj",
            "iobj",
            "amod",
            "advmod",
            "compound",
            "prt",
            "prep",
            "dobj",
            "nmod",
            "case",
            "obl",
        }

        validated = []

        for colloc in collocations:
            if len(colloc.words) != 2:
                continue

            word1, word2 = colloc.words
            found_count = 0

            for text in texts[:100]:
                if word1 not in text.lower() or word2 not in text.lower():
                    continue

                doc = self.nlp(text)

                for token in doc:
                    if token.lemma_.lower() == word1:
                        for child in token.children:
                            if child.lemma_.lower() == word2 and child.dep_ in valid_deps:
                                found_count += 1
                                colloc.example_sentence = text
                                break

                    if (
                        token.lemma_.lower() == word2
                        and token.head.lemma_.lower() == word1
                        and token.dep_ in valid_deps
                    ):
                        found_count += 1
                        colloc.example_sentence = text
                        break

                if found_count >= 2:
                    break

            if found_count >= 2:
                colloc.dependency_validated = True
                validated.append(colloc)

        return validated

    def _assign_cefr_level(self, word1: str, word2: str) -> str:
        freq1 = zipf_frequency(word1, self.language_code)
        freq2 = zipf_frequency(word2, self.language_code)

        min_freq = min(freq1, freq2)

        if min_freq >= 4.0:
            return "A1"
        if min_freq >= 3.5:
            return "A2"
        if min_freq >= 3.0:
            return "B1"
        if min_freq >= 2.5:
            return "B2"
        if min_freq >= 2.0:
            return "C1"
        return "C2"

    def get_statistics(self, collocations: list[Collocation]) -> dict:
        if not collocations:
            return {}

        by_level = defaultdict(int)
        for colloc in collocations:
            if colloc.cefr_level:
                by_level[colloc.cefr_level] += 1

        validated_count = sum(1 for c in collocations if c.dependency_validated)

        return {
            "total_collocations": len(collocations),
            "dependency_validated": validated_count,
            "validation_rate": validated_count / len(collocations) if collocations else 0,
            "by_cefr_level": dict(by_level),
            "average_score": sum(c.score for c in collocations) / len(collocations),
        }
