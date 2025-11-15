import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..config.constants import SUPPORTED_LANGUAGES
from ..core.base_normalizer import get_universal_normalizer
from ..core.database_parser import VocabularyFileParser

CEFR_FREQUENCY_RANGES = {
    "a1": (1, 1000),
    "a2": (1001, 2000),
    "b1": (2001, 4000),
    "b2": (4001, 6000),
    "c1": (6001, 10000),
    "c2": (10001, 14000),
    "d": (14001, 22000),
}


@dataclass
class WordLevelMismatch:
    word: str
    actual_rank: int | None
    expected_level: str
    current_level: str
    filename: str
    reason: str


@dataclass
class LevelCoverageResult:
    filename: str
    language_code: str
    level: str
    expected_range: tuple[int, int]
    total_words: int
    words_in_range: int
    words_out_of_range: int
    mismatches: list[WordLevelMismatch]
    coverage_percentage: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "filename": self.filename,
            "language_code": self.language_code,
            "level": self.level,
            "expected_range": {"start": self.expected_range[0], "end": self.expected_range[1]},
            "total_words": self.total_words,
            "words_in_range": self.words_in_range,
            "words_out_of_range": self.words_out_of_range,
            "coverage_percentage": round(self.coverage_percentage, 2),
            "mismatches": [
                {
                    "word": m.word,
                    "actual_rank": m.actual_rank,
                    "expected_level": m.expected_level,
                    "current_level": m.current_level,
                    "reason": m.reason,
                }
                for m in self.mismatches
            ],
        }


class LevelCoverageAnalyzer:
    def __init__(self, migrations_directory: Path | None = None):
        self.db_parser = VocabularyFileParser(migrations_directory)
        self.migrations_dir = self.db_parser.migrations_dir
        self._lemmatization_services = {}
        self._lemma_rank_maps = {}

    def _get_lemmatization_service(self, language_code: str):
        if language_code not in self._lemmatization_services:
            from ..core.lemmatization_service import get_lemmatization_service

            self._lemmatization_services[language_code] = get_lemmatization_service(language_code)
        return self._lemmatization_services[language_code]

    def extract_level_from_filename(self, filename: str) -> str | None:
        pattern = r"-(a1|a2|b1|b2|c1|c2|d)\.json$"
        match = re.search(pattern, filename.lower())
        return match.group(1) if match else None

    def extract_language_from_filename(self, filename: str) -> str | None:
        lang_mapping = {
            "english": "en",
            "german": "de",
            "spanish": "es",
        }
        for lang_name, lang_code in lang_mapping.items():
            if filename.lower().startswith(lang_name):
                return lang_code
        return None

    def get_word_frequency_rank(self, word: str, language_code: str, show_progress: bool = False) -> int | None:
        from wordfreq import top_n_list

        try:
            service = self._get_lemmatization_service(language_code)

            if language_code not in self._lemma_rank_maps:
                if show_progress:
                    print(f"    Building lemma rank map for {language_code.upper()} (25000 words)...")
                top_words = top_n_list(language_code, 25000)
                self._lemma_rank_maps[language_code] = service.build_lemma_rank_map(top_words)
                if show_progress:
                    print(f"   Lemma rank map ready for {language_code.upper()}")

            word_lemma = service.lemmatize(word)
            return self._lemma_rank_maps[language_code].get(word_lemma)
        except Exception:
            pass
        return None

    def determine_expected_level(self, rank: int) -> str:
        for level, (start, end) in CEFR_FREQUENCY_RANGES.items():
            if start <= rank <= end:
                return level
        return "unknown"

    def _analyze_words_from_entries(
        self,
        entries: list,
        normalizer,
        lang_code: str,
        level: str,
        expected_range: tuple[int, int],
        filename: str,
        show_progress: bool = False,
    ) -> tuple[int, int, list[WordLevelMismatch]]:
        mismatches = []
        words_in_range = 0
        words_out_of_range = 0
        analyzed_words = set()

        for entry in entries:
            word_variants = normalizer.extract_word_variants(entry.source_word)

            for word in word_variants:
                if not word or word in analyzed_words:
                    continue

                analyzed_words.add(word)
                rank = self.get_word_frequency_rank(word, lang_code, show_progress=show_progress)

                if rank is None:
                    words_out_of_range += 1
                    mismatches.append(
                        WordLevelMismatch(
                            word=word,
                            actual_rank=None,
                            expected_level="unknown",
                            current_level=level,
                            filename=filename,
                            reason="Word not found in top 25000 frequency list",
                        )
                    )
                elif expected_range[0] <= rank <= expected_range[1]:
                    words_in_range += 1
                else:
                    words_out_of_range += 1
                    expected_level = self.determine_expected_level(rank)

                    if expected_level == "unknown":
                        reason = f"Word rank {rank} is outside all CEFR ranges (> 22000 or < 1)"
                    else:
                        reason = f"Word rank {rank} should be in {expected_level.upper()} (range {CEFR_FREQUENCY_RANGES[expected_level][0]}-{CEFR_FREQUENCY_RANGES[expected_level][1]})"

                    mismatches.append(
                        WordLevelMismatch(
                            word=word,
                            actual_rank=rank,
                            expected_level=expected_level,
                            current_level=level,
                            filename=filename,
                            reason=reason,
                        )
                    )

        return words_in_range, words_out_of_range, mismatches

    def analyze_file(self, filename: str, show_progress: bool = True) -> LevelCoverageResult | None:
        level = self.extract_level_from_filename(filename)
        if not level:
            if show_progress:
                print(f"⚠️  Cannot extract level from filename: {filename}")
            return None

        lang_code = self.extract_language_from_filename(filename)
        if not lang_code:
            if show_progress:
                print(f"⚠️  Cannot extract language from filename: {filename}")
            return None

        if lang_code not in SUPPORTED_LANGUAGES:
            if show_progress:
                print(f"⚠️  Unsupported language: {lang_code}")
            return None

        expected_range = CEFR_FREQUENCY_RANGES.get(level)
        if not expected_range:
            if show_progress:
                print(f"⚠️  Unknown level: {level}")
            return None

        try:
            entries = self.db_parser.parse_migration_file(filename)
        except FileNotFoundError:
            if show_progress:
                print(f"⚠️  File not found: {filename}")
            return None
        except Exception as e:
            if show_progress:
                print(f"⚠️  Error parsing file: {e}")
            return None

        from ..config.config_loader import get_config_loader

        config_loader = get_config_loader()
        normalizer = get_universal_normalizer(lang_code, config_loader)

        try:
            words_in_range, words_out_of_range, mismatches = self._analyze_words_from_entries(
                entries, normalizer, lang_code, level, expected_range, filename, show_progress=show_progress
            )
        except Exception as e:
            if show_progress:
                print(f"\nUnexpected error: {e}")
            return None

        total_words = words_in_range + words_out_of_range
        coverage_percentage = (words_in_range / total_words * 100) if total_words > 0 else 0

        return LevelCoverageResult(
            filename=filename,
            language_code=lang_code,
            level=level,
            expected_range=expected_range,
            total_words=total_words,
            words_in_range=words_in_range,
            words_out_of_range=words_out_of_range,
            mismatches=mismatches,
            coverage_percentage=coverage_percentage,
        )

    def analyze_all_files(self, show_progress: bool = True) -> dict[str, LevelCoverageResult]:
        vocabulary_dir = self.migrations_dir / "data" / "vocabulary"
        if not vocabulary_dir.exists():
            if show_progress:
                print(f"⚠️  Vocabulary directory not found: {vocabulary_dir}")
            return {}

        results = {}
        for json_file in sorted(vocabulary_dir.glob("*.json")):
            filename = json_file.name

            if show_progress:
                print(f"\nAnalyzing {filename}...")

            result = self.analyze_file(filename, show_progress=show_progress)
            if result:
                results[filename] = result

                if show_progress:
                    print(
                        f"   Coverage: {result.coverage_percentage:.1f}% ({result.words_in_range}/{result.total_words} words in correct range)"
                    )
                    if result.words_out_of_range > 0:
                        print(f"   ⚠️  {result.words_out_of_range} words out of range")

        return results

    def print_summary_report(self, results: dict[str, LevelCoverageResult]):
        print("\n" + "=" * 80)
        print("LEVEL COVERAGE ANALYSIS SUMMARY")
        print("=" * 80)

        by_language = defaultdict(list)
        for filename, result in results.items():
            by_language[result.language_code].append((filename, result))

        for lang_code in sorted(by_language.keys()):
            lang_results = by_language[lang_code]
            print(f"\n {lang_code.upper()}:")

            for _filename, result in sorted(lang_results, key=lambda x: x[1].level):
                status = "✅" if result.coverage_percentage >= 90 else "⚠️"
                print(
                    f"   {status} {result.level.upper()}: {result.coverage_percentage:.1f}% coverage ({result.words_in_range}/{result.total_words} in range)"
                )

        print("\n" + "=" * 80)
