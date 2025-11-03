from collections import defaultdict
from dataclasses import dataclass
import re

from wordfreq import word_frequency

from ..config.config_loader import get_config_loader
from ..config.constants import get_pos_description
from .base_normalizer import get_universal_normalizer
from .nlp_models import get_nlp_model
from .word_source import WordSource
from .word_validator import WordValidator


@dataclass
class ProcessedWord:
    word: str
    lemma: str
    pos_tag: str
    category: str
    frequency: float
    rank: int | None
    morphology: dict
    reason: str
    metadata: dict


@dataclass
class ProcessedVocabulary:
    language_code: str
    words: list[ProcessedWord]
    categories: dict[str, list[ProcessedWord]]
    total_words: int
    filtered_count: int


class VocabularyProcessor:
    def __init__(self, language_code: str, silent: bool = False):
        self.language_code = language_code
        self.silent = silent
        self.config_loader = get_config_loader()
        self.lang_config = self.config_loader.get_language_config(language_code)

        self.normalizer = get_universal_normalizer(language_code, self.config_loader)
        self.skip_words = self.config_loader.get_skip_words(language_code)
        self.pos_categories = self.config_loader.get_pos_categories(language_code)
        self.inflection_patterns = self.config_loader.get_inflection_patterns(language_code)

        default_max_length = self.config_loader.get_analysis_defaults().get("max_word_length", 20)
        validator_config = {
            "min_word_length": self.lang_config.get("filtering", {}).get("min_word_length", 2),
            "max_word_length": self.lang_config.get("max_word_length", default_max_length),
            "skip_words": self.skip_words,
            "blacklist": self.lang_config.get("blacklist", {}),
            "filtering": self.lang_config.get("filtering", {}),
        }
        self.validator = WordValidator(validator_config)

        self._nlp_model = None

    @property
    def nlp_model(self):
        if self._nlp_model is None:
            model_preferences = self.config_loader.get_spacy_models(self.language_code)
            self._nlp_model = get_nlp_model(self.language_code, model_preferences, silent=self.silent)
        return self._nlp_model

    def process_words(
        self,
        word_source: WordSource,
        existing_words: set[str] | None = None,
        filter_inflections: bool = True,
        target_count: int | None = None,
    ) -> ProcessedVocabulary:
        if existing_words is None:
            existing_words = set()

        processed_words = []
        filtered_count = 0
        categories = defaultdict(list)

        for word_obj in word_source.get_words():
            if target_count and len(processed_words) >= target_count:
                break

            word = word_obj.text
            normalized = self.normalizer.normalize(word)

            if not self._is_valid_word(word, normalized):
                filtered_count += 1
                continue

            processed = self._analyze_word(word, word_obj.metadata or {}, existing_words, filter_inflections)

            if processed is None:
                filtered_count += 1
                continue

            processed_words.append(processed)
            categories[processed.category].append(processed)

        return ProcessedVocabulary(
            language_code=self.language_code,
            words=processed_words,
            categories=dict(categories),
            total_words=len(processed_words),
            filtered_count=filtered_count,
        )

    def _is_valid_word(self, word: str, normalized: str) -> bool:
        return self.validator.is_valid(word, normalized)

    def _analyze_word(self, word: str, metadata: dict, existing_words: set[str], filter_inflections: bool) -> ProcessedWord | None:
        doc = self.nlp_model(word)

        if not doc or len(doc) == 0:
            return None

        token = doc[0]
        lemma = token.lemma_.lower()
        pos_tag = token.pos_
        morphology = self._extract_morphology(token)

        # Filter out proper nouns (names, places, etc.)
        if pos_tag == "PROPN":
            return None

        # Filter out named entities (except numbers)
        if token.ent_type_ and token.ent_type_ not in ["ORDINAL", "CARDINAL"]:
            return None

        if filter_inflections:
            if lemma != word.lower() and lemma in existing_words:
                return None

            if self._is_likely_inflected(word, lemma, morphology):
                return None

        category = self._categorize_by_pos(pos_tag)
        reason = self._generate_reason(word, lemma, pos_tag, morphology, metadata.get("rank"))

        frequency = word_frequency(word, self.language_code)

        return ProcessedWord(
            word=word,
            lemma=lemma,
            pos_tag=pos_tag,
            category=category,
            frequency=frequency,
            rank=metadata.get("rank"),
            morphology=morphology,
            reason=reason,
            metadata=metadata,
        )

    def _extract_morphology(self, token) -> dict:
        morph = {}

        if hasattr(token, "morph"):
            morph_str = str(token.morph)
            for feature in morph_str.split("|"):
                if "=" in feature:
                    key, value = feature.split("=", 1)
                    morph[key] = value

        return morph

    def _is_likely_inflected(self, word: str, lemma: str, morphology: dict) -> bool:
        if word.lower() == lemma:
            return False

        for _pattern_type, patterns in self.inflection_patterns.items():
            for pattern in patterns:
                if re.search(pattern, word):
                    return True

        return False

    def _categorize_by_pos(self, pos_tag: str) -> str:
        for category, tags in self.pos_categories.items():
            if pos_tag in tags:
                return category
        return "other"

    def _generate_reason(self, word: str, lemma: str, pos_tag: str, morphology: dict, rank: int | None) -> str:
        pos_desc = get_pos_description(pos_tag)

        parts = []

        if rank:
            parts.append(f"Top {rank} word")

        parts.append(f"classified as {pos_desc}")

        if morphology.get("Number") == "Plur" and pos_tag == "NOUN":
            parts[-1] = "plural noun"
        elif morphology.get("Tense") == "Past" and pos_tag == "VERB":
            parts[-1] = "past tense verb"
        elif morphology.get("Degree") == "Cmp" and pos_tag == "ADJ":
            parts[-1] = "comparative adjective"
        elif morphology.get("Degree") == "Sup" and pos_tag == "ADJ":
            parts[-1] = "superlative adjective"
        elif morphology.get("VerbForm") == "Ger":
            parts[-1] = "gerund"

        return "; ".join(parts)
