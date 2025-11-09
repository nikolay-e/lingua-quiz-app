import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..config.config_loader import get_config_loader
from ..config.constants import RANK_NOT_FOUND, RANK_VERY_RARE
from ..core.base_normalizer import get_universal_normalizer
from ..core.lemmatization_service import get_lemmatization_service
from ..core.vocabulary_processor import VocabularyProcessor
from ..core.word_source import SubtitleFrequencySource


@dataclass
class MigrationAnalysisResult:
    language_code: str
    vocabulary_size: int
    frequency_size: int
    overlap: int
    missing_from_frequency: list[dict[str, Any]]
    missing_from_vocabulary: list[dict[str, Any]]
    english_words_in_vocabulary: list[dict[str, Any]]
    rare_words_in_vocabulary: list[dict[str, Any]]

    @property
    def missing_from_a1(self) -> list[dict[str, Any]]:
        return self.missing_from_vocabulary


class MigrationAnalyzer:
    def __init__(self, language_code: str, migration_file_path: str | Path):
        self.language_code = language_code
        self.migration_file_path = Path(migration_file_path)
        self.config_loader = get_config_loader()
        self.normalizer = get_universal_normalizer(language_code, self.config_loader)
        self.lemmatization_service = get_lemmatization_service(language_code)

    def _remove_accents(self, text: str) -> str:
        return "".join(c for c in unicodedata.normalize("NFD", text) if unicodedata.category(c) != "Mn")

    def _get_level_from_filename(self) -> str:
        filename = self.migration_file_path.stem
        parts = filename.split("-")
        if len(parts) >= 3:
            level = parts[-1]
            return level.lower()
        return ""

    def _get_previous_levels(self, current_level: str) -> list[str]:
        hierarchy = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"]
        if current_level not in hierarchy:
            return []
        idx = hierarchy.index(current_level)
        return hierarchy[:idx]

    def _load_vocabulary_from_file(self, file_path: Path) -> list[str]:
        if not file_path.exists():
            return []

        try:
            with open(file_path, encoding="utf-8") as f:
                data = json.load(f)

            if "word_pairs" in data:
                return [pair["source_word"] for pair in data["word_pairs"]]
        except (FileNotFoundError, json.JSONDecodeError, KeyError):
            pass

        return []

    def _load_previous_levels_vocabulary(self) -> set[str]:
        current_level = self._get_level_from_filename()
        previous_levels = self._get_previous_levels(current_level)

        all_previous_lemmas = set()

        for level in previous_levels:
            parent_dir = self.migration_file_path.parent
            filename_parts = self.migration_file_path.stem.split("-")

            if len(filename_parts) >= 3:
                language_pair = "-".join(filename_parts[:-1])
                level_file = parent_dir / f"{language_pair}-{level}.json"

                if level_file.exists():
                    words = self._load_vocabulary_from_file(level_file)
                    lemmas = self.lemmatization_service.lemmatize_batch(words)
                    all_previous_lemmas.update(lemmas)

        return all_previous_lemmas

    def _load_previous_levels_vocabulary_no_lemmatize(self) -> set[str]:
        current_level = self._get_level_from_filename()
        previous_levels = self._get_previous_levels(current_level)

        all_previous_words = set()

        for level in previous_levels:
            parent_dir = self.migration_file_path.parent
            filename_parts = self.migration_file_path.stem.split("-")

            if len(filename_parts) >= 3:
                language_pair = "-".join(filename_parts[:-1])
                level_file = parent_dir / f"{language_pair}-{level}.json"

                if level_file.exists():
                    words = self._load_vocabulary_from_file(level_file)
                    all_previous_words.update(word.lower() for word in words)

        return all_previous_words

    def _load_vocabulary(self) -> list[str]:
        with open(self.migration_file_path, encoding="utf-8") as f:
            data = json.load(f)

        if "word_pairs" in data:
            return [pair["source_word"] for pair in data["word_pairs"]]

        return []

    def analyze(self, top_n: int | None = None) -> MigrationAnalysisResult:
        if top_n is None:
            level = self._get_level_from_filename()
            if not level:
                level = "a1"
            top_n = self.config_loader.get_cumulative_total(level)

        vocabulary_words = self._load_vocabulary()

        lemmatized_words = self.lemmatization_service.lemmatize_batch(vocabulary_words)

        vocabulary_lemmas = set()
        vocabulary_lemma_map = {}

        for original_word, lemma in zip(vocabulary_words, lemmatized_words, strict=False):
            vocabulary_lemmas.add(lemma)
            if lemma not in vocabulary_lemma_map:
                vocabulary_lemma_map[lemma] = []
            vocabulary_lemma_map[lemma].append(original_word)

        previous_level_lemmas = self._load_previous_levels_vocabulary()

        combined_lemmas = vocabulary_lemmas | previous_level_lemmas

        from ..core.frequency_list_loader import find_frequency_list, load_frequency_list

        freq_list_path = find_frequency_list(self.language_code)
        if freq_list_path:
            vocab = load_frequency_list(freq_list_path)
            if len(vocab.words) > top_n:
                vocab.words = vocab.words[:top_n]
        else:
            processor = VocabularyProcessor(self.language_code, silent=True)
            multiplier = self.config_loader.get_raw_frequency_multiplier(self.language_code)
            source = SubtitleFrequencySource(self.language_code, top_n=int(top_n * multiplier), lemmatize=False)
            vocab = processor.process_words(source, filter_inflections=True, target_count=top_n, collect_stats=False)

        freq_lemmas = {word.lemma for word in vocab.words}
        freq_words_by_lemma = {word.lemma: word.word for word in vocab.words}

        import math

        lemma_to_real_rank = {word.lemma: rank for rank, word in enumerate(vocab.words, start=1)}
        lemma_to_zipf = {word.lemma: 8.0 - math.log10(rank) for rank, word in enumerate(vocab.words, start=1)}
        lemma_to_frequency = {word.lemma: word.frequency for word in vocab.words}

        overlap = vocabulary_lemmas & freq_lemmas

        missing_from_freq = sorted(vocabulary_lemmas - freq_lemmas)
        missing_analysis = []

        for lemma in missing_from_freq:
            freq = lemma_to_frequency.get(lemma, 0.0)
            zipf = lemma_to_zipf.get(lemma, 0.0)

            rank_estimate = RANK_NOT_FOUND

            original_forms = vocabulary_lemma_map[lemma]

            missing_analysis.append(
                {
                    "lemma": lemma,
                    "original_forms": original_forms,
                    "frequency": freq,
                    "zipf": zipf,
                    "rank_estimate": rank_estimate,
                }
            )

        missing_analysis.sort(key=lambda x: x["rank_estimate"])

        missing_from_vocabulary = sorted(freq_lemmas - combined_lemmas)
        missing_from_vocabulary_analysis = []

        for lemma in missing_from_vocabulary:
            freq = lemma_to_frequency.get(lemma, 0.0)
            zipf = lemma_to_zipf.get(lemma, 0.0)

            real_rank = lemma_to_real_rank.get(lemma, RANK_NOT_FOUND)

            missing_from_vocabulary_analysis.append(
                {
                    "lemma": lemma,
                    "word": freq_words_by_lemma.get(lemma, lemma),
                    "frequency": freq,
                    "zipf": zipf,
                    "rank_estimate": real_rank,
                }
            )

        missing_from_vocabulary_analysis.sort(key=lambda x: x["rank_estimate"])

        combined_normalized_map = {}
        for lemma in combined_lemmas:
            normalized = self._remove_accents(lemma)
            if normalized not in combined_normalized_map:
                combined_normalized_map[normalized] = []
            combined_normalized_map[normalized].append(lemma)

        filtered_missing = []
        for item in missing_from_vocabulary_analysis:
            lemma = item["lemma"]
            normalized = self._remove_accents(lemma)

            if normalized in combined_normalized_map:
                variants = combined_normalized_map[normalized]
                if lemma not in variants and len(variants) > 0:
                    continue

            filtered_missing.append(item)

        missing_from_vocabulary_analysis = filtered_missing

        english_words = []

        rare_words = [item for item in missing_analysis if item["rank_estimate"] > RANK_VERY_RARE]

        return MigrationAnalysisResult(
            language_code=self.language_code,
            vocabulary_size=len(vocabulary_lemmas),
            frequency_size=len(freq_lemmas),
            overlap=len(overlap),
            missing_from_frequency=missing_analysis,
            missing_from_vocabulary=missing_from_vocabulary_analysis,
            english_words_in_vocabulary=english_words,
            rare_words_in_vocabulary=rare_words,
        )

    def generate_report(self, result: MigrationAnalysisResult, output_path: str | Path):
        output_path = Path(output_path)

        level = self._get_level_from_filename() or "UNKNOWN"

        report = f"""# Отчёт: Анализ словаря {level.upper()} ({self.language_code.upper()})

## Общая статистика

| Метрика | Значение |
|---------|----------|
| Уникальных лемм в {level.upper()} | {result.vocabulary_size:,} |
| Лемм в частотном топ-{result.frequency_size} | {result.frequency_size:,} |
| Совпадение (overlap) | {result.overlap:,} ({result.overlap / result.vocabulary_size * 100:.1f}%) |
| В {level.upper()}, но НЕ в частотном списке | {len(result.missing_from_frequency):,} |
| В частотном списке, но НЕ в {level.upper()} | {len(result.missing_from_vocabulary):,} |

---

##  КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Отсутствуют базовые высокочастотные слова

**Топ-50 высокочастотных слов, отсутствующих в {level.upper()}:**

| Лемма | Ранг | Zipf | Частотность | Слово в частотном списке |
|-------|------|------|-------------|---------------------------|
"""

        # Top 50 missing from vocabulary
        for _i, item in enumerate(result.missing_from_vocabulary[:50], 1):
            report += f"| {item['lemma']} | {item['rank_estimate']:,} | {item['zipf']:.2f} | {item['frequency']:.8f} | {item['word']} |\n"

        if result.english_words_in_vocabulary:
            report += f"\n### 2. Английские слова в {level.upper()}\n\n"
            report += f"| Лемма | Формы в {level.upper()} | ES Zipf | EN Zipf | Причина |\n"
            report += "|-------|------------|---------|---------|----------|\n"

            for item in result.english_words_in_vocabulary:
                forms = ", ".join(item["original_forms"])
                es_zipf = item["zipf"]
                en_zipf = item.get("english_zipf", 0.0)

                if es_zipf == 0.0 and en_zipf > 0.0:
                    reason = "Только в английском корпусе"
                elif en_zipf > es_zipf + 2.0:
                    reason = f"EN частотнее на {en_zipf - es_zipf:.1f} Zipf"
                else:
                    reason = "Английское слово"

                report += f"| {item['lemma']} | {forms} | {es_zipf:.2f} | {en_zipf:.2f} | {reason} |\n"

        if result.rare_words_in_vocabulary:
            report += f"\n### 3. Очень редкие слова в {level.upper()} (ранг > 10,000)\n\n"
            report += f"| Лемма | Формы в {level.upper()} | Ранг | Zipf |\n"
            report += "|-------|------------|------|------|\n"

            for item in result.rare_words_in_vocabulary[:30]:
                forms = ", ".join(item["original_forms"])
                report += f"| {item['lemma']} | {forms} | {item['rank_estimate']:,} | {item['zipf']:.2f} |\n"

        report += "\n---\n\n"
        report += f"## ЛЕГИТИМНЫЕ СЛОВА В {level.upper()}\n\n"
        report += f"**Топ-50 слов из {level.upper()} (не в частотном топе, но легитимные):**\n\n"
        report += f"| Лемма | Формы в {level.upper()} | Ранг | Zipf |\n"
        report += "|-------|------------|------|------|\n"

        # Legitimate vocabulary words (high frequency but not in top N)
        legitimate = [item for item in result.missing_from_frequency if item["rank_estimate"] <= 1000]
        for item in legitimate[:50]:
            forms = ", ".join(item["original_forms"])
            report += f"| {item['lemma']} | {forms} | {item['rank_estimate']:,} | {item['zipf']:.2f} |\n"

        report += "\n---\n\n"
        report += "## РЕКОМЕНДАЦИИ\n\n"
        report += f"1. **Добавить {len([x for x in result.missing_from_vocabulary if x['rank_estimate'] <= 500])} базовых слов** (ранг < 500)\n"
        report += f"2. **Удалить {len(result.english_words_in_vocabulary)} английских слов**\n"
        report += (
            f"3. **Рассмотреть удаление {len(result.rare_words_in_vocabulary)} очень редких слов** (ранг > 10,000)\n"
        )

        output_path.write_text(report, encoding="utf-8")

        return report
