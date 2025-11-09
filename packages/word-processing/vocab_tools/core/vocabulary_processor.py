from collections import defaultdict
from dataclasses import dataclass

from ..config.config_loader import get_config_loader
from ..config.constants import get_pos_description
from .base_normalizer import get_universal_normalizer
from .lemmatization_service import get_lemmatization_service
from .nlp_models import get_nlp_model
from .processing_pipeline import ProcessingContext, ProcessingPipeline
from .processing_stages import (
    CategorizationStage,
    FilteringStatsCollector,
    InflectionFilteringStage,
    LemmatizationStage,
    NLPAnalysisStage,
    NormalizationStage,
    StatisticsCollectionStage,
    ValidationStage,
)
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
    filtering_stats: "FilteringStats | None" = None


@dataclass
class FilteringStats:
    total_analyzed: int
    total_filtered: int
    by_category: dict[str, int]
    examples: dict[str, list[str]]

    def add_filtered(self, word: str, category: str, max_examples: int = 10):
        self.by_category[category] = self.by_category.get(category, 0) + 1
        if category not in self.examples:
            self.examples[category] = []
        if len(self.examples[category]) < max_examples:
            self.examples[category].append(word)


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

        filtering_config = self.lang_config.get("filtering", {})
        self.inflection_frequency_ratio = filtering_config.get("inflection_frequency_ratio", 0.5)
        self.ner_frequency_threshold = filtering_config.get("ner_frequency_threshold") or 0.0005

        default_max_length = self.config_loader.get_analysis_defaults().get("max_word_length", 20)
        validator_config = {
            "min_word_length": filtering_config.get("min_word_length", 2),
            "max_word_length": self.lang_config.get("max_word_length", default_max_length),
            "skip_words": self.skip_words,
            "blacklist": self.lang_config.get("blacklist", {}),
            "filtering": filtering_config,
        }
        self.validator = WordValidator(validator_config)

        self._nlp_model = None
        self.lemmatization_service = get_lemmatization_service(language_code)

    @property
    def nlp_model(self):
        if self._nlp_model is None:
            model_preferences = self.config_loader.get_spacy_models(self.language_code)
            self._nlp_model = get_nlp_model(self.language_code, model_preferences, silent=self.silent)
        return self._nlp_model

    def _build_pipeline(
        self, existing_words: set[str], filter_inflections: bool, stats_collector: FilteringStatsCollector | None
    ) -> ProcessingPipeline:
        """Build processing pipeline with 7 stages."""
        stages = [
            NormalizationStage(self.normalizer),
            ValidationStage(self.validator),
            LemmatizationStage(self.lemmatization_service),
            NLPAnalysisStage(self.nlp_model, self.language_code, self.ner_frequency_threshold),
            InflectionFilteringStage(
                self.language_code,
                self.inflection_frequency_ratio,
                self.inflection_patterns,
                existing_words,
                filter_inflections,
            ),
            CategorizationStage(self.pos_categories),
            StatisticsCollectionStage(stats_collector),
        ]
        return ProcessingPipeline(stages)

    def process_words(
        self,
        word_source: WordSource,
        existing_words: set[str] | None = None,
        filter_inflections: bool = True,
        target_count: int | None = None,
        collect_stats: bool = True,
        strict_lemma_only: bool = False,
    ) -> ProcessedVocabulary:
        if existing_words is None:
            existing_words = set()

        stats_collector = FilteringStatsCollector() if collect_stats else None
        pipeline = self._build_pipeline(existing_words, filter_inflections, stats_collector)

        processed_words = []
        filtered_count = 0
        categories = defaultdict(list)
        total_analyzed = 0
        seen_lemmas = {}

        for word_obj in word_source.get_words():
            if target_count and len(processed_words) >= target_count:
                break

            total_analyzed += 1
            context = ProcessingContext(word=word_obj.text, metadata=word_obj.metadata or {})
            context = pipeline.process(context)

            if context.should_filter:
                filtered_count += 1
                continue

            if strict_lemma_only and context.word.lower() != context.lemma:
                filtered_count += 1
                if stats_collector:
                    stats_collector.add_filtered(context.word, f"strict_mode:inflection:{context.lemma}")
                continue

            processed = self._context_to_processed_word(context)

            if processed.lemma in seen_lemmas:
                filtered_count = self._handle_duplicate(
                    processed, seen_lemmas, processed_words, categories, filtered_count, stats_collector
                )
                if processed.lemma not in seen_lemmas or seen_lemmas[processed.lemma] != processed:
                    continue

            processed_words.append(processed)
            categories[processed.category].append(processed)
            seen_lemmas[processed.lemma] = processed

        stats = self._build_filtering_stats(stats_collector, total_analyzed, filtered_count) if collect_stats else None

        return ProcessedVocabulary(
            language_code=self.language_code,
            words=processed_words,
            categories=dict(categories),
            total_words=len(processed_words),
            filtered_count=filtered_count,
            filtering_stats=stats,
        )

    def _context_to_processed_word(self, context: ProcessingContext) -> ProcessedWord:
        """Convert ProcessingContext to ProcessedWord."""
        reason = self._generate_reason(
            context.word, context.lemma, context.pos_tag, context.morphology, context.metadata.get("rank")
        )

        return ProcessedWord(
            word=context.word,
            lemma=context.lemma,
            pos_tag=context.pos_tag,
            category=context.category,
            frequency=context.frequency,
            rank=context.metadata.get("rank"),
            morphology=context.morphology,
            reason=reason,
            metadata=context.metadata,
        )

    def _handle_duplicate(
        self,
        processed: ProcessedWord,
        seen_lemmas: dict,
        processed_words: list,
        categories: dict,
        filtered_count: int,
        stats_collector: FilteringStatsCollector | None,
    ) -> int:
        """Handle duplicate lemma logic."""
        existing_processed = seen_lemmas[processed.lemma]
        should_replace = False
        replacement_reason = ""

        is_current_lemma = processed.word.lower() == processed.lemma
        is_existing_lemma = existing_processed.word.lower() == existing_processed.lemma

        if is_current_lemma and not is_existing_lemma:
            should_replace = True
            replacement_reason = f"replaced_by_lemma:{processed.lemma}"
        elif not is_current_lemma and is_existing_lemma:
            filtered_count += 1
            if stats_collector:
                stats_collector.add_filtered(processed.word, f"duplicate:lemma_exists:{processed.lemma}")
            return filtered_count
        elif processed.frequency > existing_processed.frequency * 1.2:
            should_replace = True
            replacement_reason = f"replaced_by_higher_freq:{processed.lemma}:freq={processed.frequency:.6f}"
        else:
            filtered_count += 1
            if stats_collector:
                stats_collector.add_filtered(processed.word, f"duplicate:lower_freq:{processed.lemma}")
            return filtered_count

        if should_replace:
            processed_words[:] = [w for w in processed_words if w.lemma != processed.lemma]
            categories[existing_processed.category] = [
                w for w in categories[existing_processed.category] if w.lemma != processed.lemma
            ]

            processed_words.append(processed)
            categories[processed.category].append(processed)
            seen_lemmas[processed.lemma] = processed

            if stats_collector:
                stats_collector.add_filtered(existing_processed.word, replacement_reason)

        return filtered_count

    def _build_filtering_stats(
        self, stats_collector: FilteringStatsCollector, total_analyzed: int, filtered_count: int
    ) -> FilteringStats:
        """Build FilteringStats from stats_collector."""
        return FilteringStats(
            total_analyzed=total_analyzed,
            total_filtered=filtered_count,
            by_category=stats_collector.by_category,
            examples=stats_collector.examples,
        )

    def _generate_reason(self, word: str, lemma: str, pos_tag: str, morphology: dict, rank: int | None) -> str:
        parts = []

        if rank:
            parts.append(f"Top {rank} word")

        if morphology.get("_description"):
            parts.append(f"classified as {morphology['_description']}")
        else:
            pos_desc = get_pos_description(pos_tag)
            parts.append(f"classified as {pos_desc}")

        if morphology.get("_is_marked"):
            parts.append("marked form")

        return "; ".join(parts)

    def print_filtering_report(self, stats: FilteringStats, verbose: int = 1):
        if not stats or stats.total_filtered == 0:
            return

        print("\nFiltering Statistics:")
        print(f"   • Total analyzed: {stats.total_analyzed:,}")
        print(f"   • Filtered out: {stats.total_filtered:,} ({stats.total_filtered / stats.total_analyzed * 100:.1f}%)")
        print(
            f"   • Passed: {stats.total_analyzed - stats.total_filtered:,} ({(stats.total_analyzed - stats.total_filtered) / stats.total_analyzed * 100:.1f}%)"
        )

        if verbose >= 1:
            print("\nFiltering Breakdown:")

            validation_cats = {k: v for k, v in stats.by_category.items() if k.startswith("validation:")}
            nlp_cats = {k: v for k, v in stats.by_category.items() if k.startswith("nlp:")}
            inflection_cats = {k: v for k, v in stats.by_category.items() if k.startswith("inflection:")}

            if validation_cats:
                total_validation = sum(validation_cats.values())
                print(
                    f"   • Validation filters: {total_validation:,} words ({total_validation / stats.total_filtered * 100:.1f}%)"
                )
                for cat, count in sorted(validation_cats.items(), key=lambda x: x[1], reverse=True):
                    cat_name = cat.replace("validation:", "")
                    print(f"      - {cat_name}: {count}")

            if nlp_cats:
                total_nlp = sum(nlp_cats.values())
                print(f"   • NLP filters: {total_nlp:,} words ({total_nlp / stats.total_filtered * 100:.1f}%)")
                for cat, count in sorted(nlp_cats.items(), key=lambda x: x[1], reverse=True)[:5]:
                    cat_name = cat.replace("nlp:", "")
                    print(f"      - {cat_name}: {count}")

            if inflection_cats:
                total_inflection = sum(inflection_cats.values())
                print(
                    f"   • Inflection filters: {total_inflection:,} words ({total_inflection / stats.total_filtered * 100:.1f}%)"
                )

        if verbose >= 2 and stats.examples:
            print("\nExamples (first 10 per category):")
            for cat in sorted(stats.examples.keys()):
                examples = stats.examples[cat][:10]
                cat_display = cat.replace("validation:", "").replace("nlp:", "").replace("inflection:", "")
                examples_str = ", ".join(examples)
                print(f"   • {cat_display}: [{examples_str}]")
