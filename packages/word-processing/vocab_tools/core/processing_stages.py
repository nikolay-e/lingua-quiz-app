from wordfreq import word_frequency

from .base_normalizer import UniversalNormalizer
from .lemmatization_service import LemmatizationService
from .processing_pipeline import ProcessingContext, ProcessingStage
from .word_validator import WordValidator


class NormalizationStage(ProcessingStage):
    """Stage 1: Normalize text."""

    def __init__(self, normalizer: UniversalNormalizer):
        self.normalizer = normalizer

    def process(self, context: ProcessingContext) -> ProcessingContext:
        context.normalized = self.normalizer.normalize(context.word)
        return context

    @property
    def name(self) -> str:
        return "normalization"


class ValidationStage(ProcessingStage):
    """Stage 2: Validate word (length, blacklist, patterns)."""

    def __init__(self, validator: WordValidator):
        self.validator = validator

    def process(self, context: ProcessingContext) -> ProcessingContext:
        if not context.normalized:
            context.should_filter = True
            context.filter_reason = "validation:no_normalized"
            return context

        if not self.validator.is_valid(context.word, context.normalized):
            category, reason = self.validator.get_rejection_reason(context.word, context.normalized)
            context.should_filter = True
            context.filter_reason = f"validation:{category}"
        return context

    @property
    def name(self) -> str:
        return "validation"


class LemmatizationStage(ProcessingStage):
    """Stage 3: Get lemma."""

    def __init__(self, lemmatization_service: LemmatizationService):
        self.lemmatization_service = lemmatization_service

    def process(self, context: ProcessingContext) -> ProcessingContext:
        context.lemma = self.lemmatization_service.lemmatize(context.word)
        return context

    @property
    def name(self) -> str:
        return "lemmatization"


class NLPAnalysisStage(ProcessingStage):
    """Stage 4: POS tagging, morphology, frequency, NER filtering."""

    def __init__(self, nlp_model, language_code: str, ner_frequency_threshold: float):
        self.nlp_model = nlp_model
        self.language_code = language_code
        self.ner_frequency_threshold = ner_frequency_threshold

    def process(self, context: ProcessingContext) -> ProcessingContext:
        doc = self.nlp_model(context.word)

        if not doc or len(doc) == 0:
            context.should_filter = True
            context.filter_reason = "nlp:failed_parse"
            return context

        token = doc[0]
        context.pos_tag = token.pos_
        context.morphology = self._extract_morphology(token)
        context.frequency = word_frequency(context.word, self.language_code)

        if context.pos_tag == "PROPN":
            context.should_filter = True
            context.filter_reason = "nlp:proper_noun"
            return context

        if (
            token.ent_type_
            and token.ent_type_ not in ["ORDINAL", "CARDINAL"]
            and context.frequency < self.ner_frequency_threshold
        ):
            context.should_filter = True
            context.filter_reason = f"nlp:named_entity:{token.ent_type_}"

        return context

    def _extract_morphology(self, token) -> dict:
        morphology = {}
        if hasattr(token, "morph") and token.morph:
            for feat in token.morph:
                key, value = feat.split("=") if "=" in feat else (feat, True)
                morphology[key] = value
        return morphology

    @property
    def name(self) -> str:
        return "nlp_analysis"


class InflectionFilteringStage(ProcessingStage):
    """Stage 5: Filter inflections by frequency ratio."""

    def __init__(
        self,
        language_code: str,
        inflection_frequency_ratio: float,
        inflection_patterns: dict,
        existing_words: set[str],
        filter_inflections: bool,
    ):
        self.language_code = language_code
        self.inflection_frequency_ratio = inflection_frequency_ratio
        self.inflection_patterns = inflection_patterns
        self.existing_words = existing_words
        self.filter_inflections = filter_inflections

    def process(self, context: ProcessingContext) -> ProcessingContext:
        if not self.filter_inflections:
            return context

        if not context.lemma or not context.morphology:
            return context

        lemma_freq = word_frequency(context.lemma, self.language_code)

        if context.lemma != context.word.lower() and context.lemma in self.existing_words:
            if lemma_freq > 0 and context.frequency < lemma_freq * self.inflection_frequency_ratio:
                freq_ratio = context.frequency / lemma_freq if lemma_freq > 0 else 0
                context.should_filter = True
                context.filter_reason = f"inflection:existing_lemma:{context.lemma}:freq_ratio={freq_ratio:.2f}"
                return context

        if self._is_likely_inflected(context.word, context.lemma, context.morphology):
            if lemma_freq > 0 and context.frequency < lemma_freq * self.inflection_frequency_ratio:
                freq_ratio = context.frequency / lemma_freq if lemma_freq > 0 else 0
                context.should_filter = True
                context.filter_reason = f"inflection:pattern_match:{context.lemma}:freq_ratio={freq_ratio:.2f}"

        return context

    def _is_likely_inflected(self, word: str, lemma: str, morphology: dict) -> bool:
        if word.lower() == lemma:
            return False

        for _pos_pattern, suffixes in self.inflection_patterns.items():
            for suffix in suffixes:
                if word.endswith(suffix) and not lemma.endswith(suffix):
                    return True
        return False

    @property
    def name(self) -> str:
        return "inflection_filtering"


class CategorizationStage(ProcessingStage):
    """Stage 6: Assign category by POS tag."""

    def __init__(self, pos_categories: dict):
        self.pos_categories = pos_categories

    def process(self, context: ProcessingContext) -> ProcessingContext:
        if not context.pos_tag:
            context.category = "other"
            return context

        for category, pos_tags in self.pos_categories.items():
            if context.pos_tag in pos_tags:
                context.category = category
                return context

        context.category = "other"
        return context

    @property
    def name(self) -> str:
        return "categorization"


class StatisticsCollectionStage(ProcessingStage):
    """Stage 7: Collect filtering statistics."""

    def __init__(self, stats_collector: "FilteringStatsCollector | None"):
        self.stats_collector = stats_collector

    def process(self, context: ProcessingContext) -> ProcessingContext:
        if self.stats_collector and context.should_filter and context.filter_reason:
            self.stats_collector.add_filtered(context.word, context.filter_reason)
        return context

    @property
    def name(self) -> str:
        return "statistics_collection"


class FilteringStatsCollector:
    """Collects filtering statistics during processing."""

    def __init__(self, max_examples: int = 10):
        self.max_examples = max_examples
        self.by_category: dict[str, int] = {}
        self.examples: dict[str, list[str]] = {}
        self.total_filtered = 0

    def add_filtered(self, word: str, category: str):
        self.total_filtered += 1
        self.by_category[category] = self.by_category.get(category, 0) + 1

        if category not in self.examples:
            self.examples[category] = []
        if len(self.examples[category]) < self.max_examples:
            self.examples[category].append(word)
