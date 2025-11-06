from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

from ..config.config_loader import get_config_loader
from ..core.database_parser import VocabularyFileParser
from ..core.vocabulary_processor import VocabularyProcessor
from .base_validation import BaseValidationIssue, BaseValidationResult


@dataclass
class WordQualityIssue(BaseValidationIssue):
    word: str = ""
    reason: str = ""

    def get_message(self) -> str:
        return f"'{self.word}' - {self.reason}"

    def to_dict(self) -> dict:
        base_dict = super().to_dict()
        base_dict["word"] = self.word
        base_dict["reason"] = self.reason
        return base_dict


@dataclass
class WordQualityResult(BaseValidationResult):
    language_code: str = ""
    valid_words: int = 0

    @property
    def total_words_checked(self) -> int:
        return self.total_checked

    @property
    def problematic_words(self) -> int:
        return len(self.issues)

    @property
    def quality_score(self) -> float:
        if self.total_checked == 0:
            return 100.0
        return (self.valid_words / self.total_checked) * 100

    def to_dict(self) -> dict:
        result = super().to_dict()
        result["language_code"] = self.language_code
        result["total_words_checked"] = self.total_words_checked
        result["valid_words"] = self.valid_words
        result["problematic_words"] = self.problematic_words
        result["quality_score"] = round(self.quality_score, 2)
        return result


class WordQualityValidator:
    def __init__(self, migrations_directory: Path | None = None):
        self.db_parser = VocabularyFileParser(migrations_directory)
        self.config_loader = get_config_loader()

    def validate_all_migrations(self, silent: bool = False) -> dict[str, WordQualityResult]:
        if not silent:
            print("VALIDATING WORD QUALITY IN MIGRATION FILES")
            print("=" * 80)

        discovered_files = self.db_parser.discover_migration_files()
        results = {}

        for language, filenames in discovered_files.items():
            if not silent:
                print(f"\n Validating {language.upper()} migration files...")

            result = self._validate_language_files(language, filenames)
            results[language] = result

            if not silent:
                self._print_language_summary(result)

        return results

    def _validate_language_files(self, language: str, filenames: list[str]) -> WordQualityResult:
        processor = VocabularyProcessor(language, silent=True)
        result = WordQualityResult(
            language_code=language,
            total_checked=0,
            valid_words=0,
        )

        for filename in filenames:
            try:
                file_result = self._validate_file(language, filename, processor)

                result.files_validated.append(filename)
                result.total_checked += file_result.total_checked
                result.valid_words += file_result.valid_words
                result.issues.extend(file_result.issues)

            except Exception as e:
                print(f"   Error validating {filename}: {e}")

        return result

    def _validate_file(self, language: str, filename: str, processor: VocabularyProcessor) -> WordQualityResult:
        entries = self.db_parser.parse_migration_file(filename)

        result = WordQualityResult(
            language_code=language,
            total_checked=0,
            valid_words=0,
            files_validated=[filename],
        )

        for entry in entries:
            word_variants = self._extract_word_variants(entry.source_word)

            for word in word_variants:
                if not word or not word.strip():
                    continue

                result.total_checked += 1
                normalized = processor.normalizer.normalize(word)

                validation_result = self._validate_word(
                    word=word,
                    normalized=normalized,
                    processor=processor,
                    filename=filename,
                    entry_id=entry.translation_id,
                )

                if validation_result:
                    result.issues.append(validation_result)
                else:
                    result.valid_words += 1

        return result

    def _validate_word(
        self,
        word: str,
        normalized: str,
        processor: VocabularyProcessor,
        filename: str,
        entry_id: int,
    ) -> WordQualityIssue | None:
        if not processor.validator.is_valid(word, normalized):
            issue_category, reason = processor.validator.get_rejection_reason(word, normalized)

            return WordQualityIssue(
                severity="warning",
                category=issue_category,
                word=word,
                reason=reason,
                file_name=filename,
                entry_id=entry_id,
            )

        return None

    def _extract_word_variants(self, source_word: str) -> list[str]:
        if "," in source_word:
            return [w.strip() for w in source_word.split(",") if w.strip()]
        return [source_word.strip()]

    def _print_language_summary(self, result: WordQualityResult):
        """Print summary for a single language."""
        print(f"   Total words checked: {result.total_words_checked:,}")
        print(f"   Valid words: {result.valid_words:,}")
        print(f"   ⚠️  Problematic words: {result.problematic_words:,}")
        print(f"    Quality score: {result.quality_score:.1f}%")

    def print_full_report(self, results: dict[str, WordQualityResult], show_details: bool = True):
        print("\n" + "=" * 80)
        print("WORD QUALITY VALIDATION REPORT")
        print("=" * 80)

        total_words = sum(r.total_words_checked for r in results.values())
        total_valid = sum(r.valid_words for r in results.values())
        total_issues = sum(r.problematic_words for r in results.values())

        print("\nOverall Summary:")
        print(f"   • Total words checked: {total_words:,}")
        print(f"   • Valid words: {total_valid:,}")
        print(f"   • Problematic words: {total_issues:,}")
        print(f"   • Overall quality: {(total_valid / total_words * 100) if total_words else 0:.1f}%")

        print("\n By Language:")
        for lang_code, result in sorted(results.items()):
            print(f"   • {lang_code.upper()}:")
            print(f"     - Quality score: {result.quality_score:.1f}%")
            print(f"     - Problematic: {result.problematic_words:,}/{result.total_words_checked:,}")

        if show_details:
            self._print_detailed_issues(results)

        print("\n" + "=" * 80)

    def _print_detailed_issues(self, results: dict[str, WordQualityResult]):
        """Print detailed breakdown of issues by category."""
        print("\nIssues by Category:")

        for lang_code, result in sorted(results.items()):
            if not result.issues:
                continue

            print(f"\n   {lang_code.upper()} ({result.problematic_words} issues):")

            category_groups = defaultdict(list)
            for issue in result.issues:
                category_groups[issue.category].append(issue)

            for category, issues in sorted(category_groups.items()):
                print(f"      • {category}: {len(issues)} words")

                examples = issues[:5]
                for issue in examples:
                    print(f"        - '{issue.word}' ({issue.reason})")

                if len(issues) > 5:
                    print(f"        ... and {len(issues) - 5} more")
