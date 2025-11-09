import csv
import json
from pathlib import Path
from typing import Any

from wordfreq import zipf_frequency

from .transliteration_detector import TransliterationDetector
from .vocabulary_analyzer import VocabularyAnalyzer


class FullReportGenerator:
    def __init__(self, language_code: str, migration_file_path: Path, top_n: int | None = None):
        from ..config.config_loader import get_config_loader

        self.language_code = language_code
        self.migration_file_path = Path(migration_file_path)
        self.analyzer = VocabularyAnalyzer(language_code, migration_file_path)
        self.config_loader = get_config_loader()

        self.level = self._get_level_from_filename()
        if not self.level:
            self.level = "a1"

        if top_n is None:
            cumulative = self.config_loader.get_cumulative_total(self.level)
            self.top_n = cumulative if cumulative > 0 else 50000
        else:
            self.top_n = top_n

        level_config = self.config_loader.config.get_cefr_level(self.level)
        if level_config:
            self.rank_range = level_config.rank_range
        else:
            self.rank_range = [1, 1000]

    def _get_level_from_filename(self) -> str:
        filename = self.migration_file_path.stem
        parts = filename.split("-")
        if len(parts) >= 3:
            level = parts[-1]
            return level.lower()
        return ""

    def _analyze_transliterations(self) -> list[dict[str, Any]]:
        with open(self.migration_file_path, encoding="utf-8") as f:
            migration_data = json.load(f)

        word_pairs = migration_data.get("word_pairs", [])

        pairs = [
            (pair.get("source_word", ""), pair.get("target_word", ""))
            for pair in word_pairs
            if pair.get("source_word") and pair.get("target_word") and pair.get("target_word") != "[PLACEHOLDER]"
        ]

        detector = TransliterationDetector(similarity_threshold=0.9)
        transliterations = detector.find_transliterations(pairs, source_lang=self.language_code, target_lang="ru")

        return transliterations

    def generate_full_report(self, output_dir: Path) -> dict[str, Any]:
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        validation_errors = []
        validation_warnings = []

        try:
            with open(self.migration_file_path, encoding="utf-8") as f:
                migration_data = json.load(f)

            word_pairs = migration_data.get("word_pairs", [])

            for pair in word_pairs:
                source = pair.get("source_word", "")
                target = pair.get("target_word", "")

                if not target or target == "[PLACEHOLDER]":
                    validation_errors.append(
                        {"type": "empty_translation", "word": source, "message": f'Empty or placeholder translation for "{source}"'}
                    )

                if not source:
                    validation_errors.append({"type": "empty_source", "word": target, "message": f'Empty source word for translation "{target}"'})

            source_words = [p.get("source_word", "") for p in word_pairs if p.get("source_word")]
            from collections import Counter

            word_counts = Counter(source_words)
            duplicates = {word: count for word, count in word_counts.items() if count > 1}

            for word, count in duplicates.items():
                validation_errors.append({"type": "duplicate_word", "word": word, "message": f'Duplicate word "{word}" appears {count} times'})

        except Exception as e:
            validation_errors.append({"type": "file_error", "word": "N/A", "message": f"Error reading file: {e!s}"})

        validation_result = {
            "errors": validation_errors,
            "warnings": validation_warnings,
        }

        result = self.analyzer.analyze(top_n=self.top_n)

        vocab_words = self.analyzer._load_vocabulary()

        lemmatized = self.analyzer.lemmatization_service.lemmatize_batch(vocab_words)

        vocab_lemma_map = {}
        for original_word, lemma in zip(vocab_words, lemmatized, strict=False):
            if lemma not in vocab_lemma_map:
                vocab_lemma_map[lemma] = []
            vocab_lemma_map[lemma].append(original_word)

        from ..core.frequency_list_loader import find_frequency_list, load_frequency_list

        freq_list_path = find_frequency_list(self.language_code)
        if freq_list_path:
            vocab = load_frequency_list(freq_list_path)
            if len(vocab.words) > self.top_n:
                vocab.words = vocab.words[: self.top_n]
        else:
            from ..core.vocabulary_processor import VocabularyProcessor
            from ..core.word_source import SubtitleFrequencySource

            processor = VocabularyProcessor(self.language_code, silent=True)
            multiplier = self.config_loader.get_raw_frequency_multiplier(self.language_code)
            source = SubtitleFrequencySource(self.language_code, top_n=int(self.top_n * multiplier), lemmatize=False)
            vocab = processor.process_words(source, filter_inflections=True, target_count=self.top_n, collect_stats=False)

        lemma_to_real_rank = {word.lemma: rank for rank, word in enumerate(vocab.words, start=1)}

        detailed_data = self._categorize_all_words(vocab_lemma_map, lemma_to_real_rank)

        for missing_word in result.missing_from_a1:
            detailed_data.append(
                {
                    "lemma": missing_word["lemma"],
                    "forms": [missing_word["word"]],
                    "rank": missing_word["rank_estimate"],
                    "zipf": missing_word["zipf"],
                    "english_zipf": 0.0,
                    "category": self._categorize_by_rank(missing_word["rank_estimate"]),
                    "priority": self._get_priority(missing_word["rank_estimate"]),
                    "status": "MISSING",
                }
            )

        detailed_data.sort(key=lambda x: (x["priority"], x["rank"]))

        transliterations = self._analyze_transliterations()

        report_path = output_dir / f"{self.language_code}_vocabulary_FULL_REPORT.md"
        json_path = output_dir / f"{self.language_code}_vocabulary_detailed.json"
        csv_path = output_dir / f"{self.language_code}_vocabulary_analysis.csv"

        self._generate_markdown_report(detailed_data, result, report_path, vocab_words, vocab_lemma_map, transliterations, validation_result)

        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(detailed_data, f, ensure_ascii=False, indent=2)

        with open(csv_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["lemma", "forms", "rank", "zipf", "english_zipf", "category", "priority", "status"],
            )
            writer.writeheader()
            for row in detailed_data:
                row_copy = row.copy()
                row_copy["forms"] = ", ".join(row_copy["forms"])
                writer.writerow(row_copy)

        stats = self._calculate_statistics(detailed_data, result, vocab_words, vocab_lemma_map)

        return {
            "stats": stats,
            "files": {
                "markdown": report_path,
                "json": json_path,
                "csv": csv_path,
            },
        }

    def _categorize_by_rank(self, rank: int) -> str:
        range_start, range_end = self.rank_range
        range_size = range_end - range_start + 1

        if rank < range_start:
            return "TOO_HIGH_FREQUENCY"
        if rank <= range_start + (range_size * 0.25):
            return "HIGH_FREQUENCY"
        if rank <= range_start + (range_size * 0.5):
            return "VERY_COMMON"
        if rank <= range_end:
            return "LEGITIMATE"
        if rank <= range_end * 2:
            return "LOW_PRIORITY"
        return "VERY_RARE"

    def _get_priority(self, rank: int) -> int:
        range_start, range_end = self.rank_range
        range_size = range_end - range_start + 1

        if rank < range_start:
            return 0
        if rank <= range_start + (range_size * 0.25):
            return 1
        if rank <= range_start + (range_size * 0.5):
            return 2
        if rank <= range_end:
            return 3
        if rank <= range_end * 2:
            return 4
        return 6

    def _categorize_all_words(self, vocab_lemma_map: dict[str, list[str]], lemma_to_real_rank: dict[str, int]) -> list[dict[str, Any]]:
        detailed_data = []

        for lemma, forms in vocab_lemma_map.items():
            target_zipf = zipf_frequency(lemma, self.language_code)

            if lemma in lemma_to_real_rank:
                rank_estimate = lemma_to_real_rank[lemma]
            elif target_zipf > 0:
                rank_estimate = int(10 ** (8 - target_zipf))
            else:
                rank_estimate = 999999

            english_zipf = zipf_frequency(lemma, "en")
            is_english = False

            if english_zipf > target_zipf + 2.0 or (target_zipf == 0.0 and english_zipf > 0.0):
                is_english = True

            if is_english:
                category = "ENGLISH"
                priority = 1
            else:
                category = self._categorize_by_rank(rank_estimate)
                priority = self._get_priority(rank_estimate)

            detailed_data.append(
                {
                    "lemma": lemma,
                    "forms": forms,
                    "rank": rank_estimate,
                    "zipf": target_zipf,
                    "english_zipf": english_zipf,
                    "category": category,
                    "priority": priority,
                    "status": "IN_VOCABULARY",
                }
            )

        return detailed_data

    def _generate_markdown_report(
        self,
        detailed_data: list[dict[str, Any]],
        result: Any,
        output_path: Path,
        vocab_words: list[str],
        vocab_lemma_map: dict[str, list[str]],
        transliterations: list[dict[str, Any]],
        validation_result: dict[str, Any],
    ):
        lang_upper = self.language_code.upper()
        range_start, range_end = self.rank_range
        range_size = range_end - range_start + 1

        high_freq_threshold = range_start + int(range_size * 0.25)
        very_rare_threshold = range_end * 2

        total_errors = len(validation_result.get("errors", []))
        total_warnings = len(validation_result.get("warnings", []))

        report = f"""# ПОЛНЫЙ ОТЧЁТ: Анализ словаря ({lang_upper} {self.level.upper()})

## Общая статистика

| Метрика | Значение |
|---------|----------|
| Уровень CEFR | {self.level.upper()} |
| Целевой диапазон рангов | {range_start:,} - {range_end:,} |
| Всего слов в словаре | {len(vocab_words):,} |
| Уникальных лемм | {len(vocab_lemma_map):,} |
| Высокочастотные (ранг ≤ {high_freq_threshold:,}) | {len([x for x in detailed_data if x["rank"] <= high_freq_threshold]):,} |
| Английские слова | {len([x for x in detailed_data if x["category"] == "ENGLISH"]):,} |
| Очень редкие (ранг > {very_rare_threshold:,}) | {len([x for x in detailed_data if x["rank"] > very_rare_threshold]):,} |
| **Ошибки валидации** | **{total_errors}** |
| **Предупреждения валидации** | **{total_warnings}** |

---

## ПРОБЛЕМЫ ВАЛИДАЦИИ

### Ошибки ({total_errors})

"""

        # Add validation errors
        errors = validation_result.get("errors", [])
        if errors:
            # Group errors by type
            error_groups = {}
            for error in errors:
                error_type = error.get("type", "Unknown")
                if error_type not in error_groups:
                    error_groups[error_type] = []
                error_groups[error_type].append(error)

            for error_type, error_list in sorted(error_groups.items()):
                report += f"\n**{error_type}** ({len(error_list)} случаев):\n\n"
                for i, error in enumerate(error_list, 1):  # Show ALL
                    word = error.get("word", "N/A")
                    message = error.get("message", "")
                    report += f"{i}. `{word}` - {message}\n"
        else:
            report += "Ошибок не обнаружено\n"

        report += f"""
### Предупреждения ({total_warnings})

"""

        # Add validation warnings
        warnings = validation_result.get("warnings", [])
        if warnings:
            for i, warning in enumerate(warnings, 1):  # Show ALL
                word = warning.get("word", "N/A")
                message = warning.get("message", "")
                report += f"{i}. `{word}` - {message}\n"
        else:
            report += "Предупреждений нет\n"

        report += """
---

##  КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1. Английские слова (удалить)

| № | Лемма | Формы | {lang_upper} Zipf | EN Zipf | Разница | Причина |
|---|-------|-------|---------|---------|---------|---------|
"""

        english_words = [x for x in detailed_data if x["category"] == "ENGLISH"]
        for i, word in enumerate(english_words, 1):
            forms = ", ".join(word["forms"])
            target_zipf = word["zipf"]
            en_zipf = word["english_zipf"]
            diff = en_zipf - target_zipf

            reason = "Только в EN корпусе" if target_zipf == 0.0 and en_zipf > 0.0 else f"EN частотнее на {diff:.1f}"

            report += f"| {i} | {word['lemma']} | {forms} | {target_zipf:.2f} | {en_zipf:.2f} | +{diff:.1f} | {reason} |\n"

        report += f"""
### 2. Очень редкие слова (ранг > {very_rare_threshold:,})

**Всего: {len([x for x in detailed_data if x["rank"] > very_rare_threshold])} слов**

| № | Лемма | Формы | Ранг | Zipf | Рекомендация |
|---|-------|-------|------|------|--------------|
"""

        rare_words = [x for x in detailed_data if x["rank"] > very_rare_threshold]
        for i, word in enumerate(rare_words, 1):
            forms = ", ".join(word["forms"])
            recommendation = "Слишком редкое"
            report += f"| {i} | {word['lemma']} | {forms} | {word['rank']:,} | {word['zipf']:.2f} | {recommendation} |\n"

        report += f"""
### 3. Транслитерации (переместить в A0)

**Всего: {len(transliterations)} слов**

Эти слова являются прямой транслитерацией между языками и должны быть перемещены на уровень A0 (базовый словарь для начинающих).

| № | Источник ({lang_upper}) | Перевод (RU) | Схожесть | Рекомендация |
|---|-------------|------------|----------|--------------|
"""

        for i, trans in enumerate(transliterations, 1):
            report += f"| {i} | {trans['source_word']} | {trans['target_word']} | {trans['similarity']:.1%} | {trans['recommendation']} |\n"

        report += f"""
---

## ➕ НЕДОСТАЮЩИЕ СЛОВА (добавить)

**Высокочастотные слова из топ-{self.top_n}, отсутствующие в словаре: {len(result.missing_from_a1)}**

### Все недостающие слова (по убыванию частотности)

| № | Лемма | Ранг | Zipf | Частотность | Приоритет |
|---|-------|------|------|-------------|-----------|
"""

        critical_threshold = range_start + int(range_size * 0.1)
        high_threshold = range_start + int(range_size * 0.25)
        medium_threshold = range_start + int(range_size * 0.5)

        for i, item in enumerate(result.missing_from_a1, 1):
            rank = item["rank_estimate"]
            priority = (
                " КРИТИЧНО"
                if rank <= critical_threshold
                else " ВЫСОКИЙ"
                if rank <= high_threshold
                else " СРЕДНИЙ"
                if rank <= medium_threshold
                else "⚪ НИЗКИЙ"
            )
            report += f"| {i} | {item['lemma']} | {item['rank_estimate']:,} | {item['zipf']:.2f} | {item['frequency']:.8f} | {priority} |\n"

        report += f"""
---

## ЛЕГИТИМНЫЕ СЛОВА

### Высокочастотные слова (ранг {range_start:,} - {high_freq_threshold:,})

**Всего: {len([x for x in detailed_data if range_start <= x["rank"] <= high_freq_threshold])} слов**

| № | Лемма | Формы | Ранг | Zipf | Статус |
|---|-------|-------|------|------|--------|
"""

        legitimate = [x for x in detailed_data if range_start <= x["rank"] <= high_freq_threshold]
        for i, word in enumerate(legitimate, 1):
            forms = ", ".join(word["forms"])
            report += f"| {i} | {word['lemma']} | {forms} | {word['rank']:,} | {word['zipf']:.2f} | Отлично |\n"

        moderate_threshold = range_start + int(range_size * 0.5)
        report += f"""
### Умеренно частотные слова (ранг {high_freq_threshold + 1:,} - {moderate_threshold:,})

**Всего: {len([x for x in detailed_data if high_freq_threshold < x["rank"] <= moderate_threshold])} слов**

| № | Лемма | Формы | Ранг | Zipf | Статус |
|---|-------|-------|------|------|--------|
"""

        moderate = [x for x in detailed_data if high_freq_threshold < x["rank"] <= moderate_threshold]
        for i, word in enumerate(moderate, 1):
            forms = ", ".join(word["forms"])
            report += f"| {i} | {word['lemma']} | {forms} | {word['rank']:,} | {word['zipf']:.2f} | Приемлемо |\n"

        report += f"""
### В целевом диапазоне (ранг {moderate_threshold + 1:,} - {range_end:,})

**Всего: {len([x for x in detailed_data if moderate_threshold < x["rank"] <= range_end])} слов**

| № | Лемма | Формы | Ранг | Zipf | Статус |
|---|-------|-------|------|------|--------|
"""

        low_priority = [x for x in detailed_data if moderate_threshold < x["rank"] <= range_end]
        for i, word in enumerate(low_priority, 1):
            forms = ", ".join(word["forms"])
            report += f"| {i} | {word['lemma']} | {forms} | {word['rank']:,} | {word['zipf']:.2f} | ⚪ Низкий приоритет |\n"

        output_path.write_text(report, encoding="utf-8")

    def _calculate_statistics(
        self,
        detailed_data: list[dict[str, Any]],
        result: Any,
        vocab_words: list[str],
        vocab_lemma_map: dict[str, list[str]],
    ) -> dict[str, Any]:
        range_start, range_end = self.rank_range
        range_size = range_end - range_start + 1
        high_freq_threshold = range_start + int(range_size * 0.25)
        moderate_threshold = range_start + int(range_size * 0.5)
        very_rare_threshold = range_end * 2

        critical_threshold = range_start + int(range_size * 0.1)
        high_threshold = range_start + int(range_size * 0.25)
        medium_threshold = range_start + int(range_size * 0.5)

        english_words = [x for x in detailed_data if x["category"] == "ENGLISH"]
        rare_words = [x for x in detailed_data if x["rank"] > very_rare_threshold]
        low_priority = [x for x in detailed_data if moderate_threshold < x["rank"] <= range_end]
        moderate = [x for x in detailed_data if high_freq_threshold < x["rank"] <= moderate_threshold]
        legitimate = [x for x in detailed_data if range_start <= x["rank"] <= high_freq_threshold]

        return {
            "total_words": len(vocab_words),
            "unique_lemmas": len(vocab_lemma_map),
            "in_vocabulary": {
                "english": len(english_words),
                "very_rare": len(rare_words),
                "low_priority": len(low_priority),
                "moderate": len(moderate),
                "high_frequency": len(legitimate),
            },
            "missing": {
                "total": len(result.missing_from_a1),
                "critical": len([x for x in result.missing_from_a1 if x["rank_estimate"] <= critical_threshold]),
                "high_priority": len([x for x in result.missing_from_a1 if x["rank_estimate"] <= high_threshold]),
                "medium_priority": len([x for x in result.missing_from_a1 if x["rank_estimate"] <= medium_threshold]),
                "low_priority": len([x for x in result.missing_from_a1 if x["rank_estimate"] > medium_threshold]),
            },
        }
