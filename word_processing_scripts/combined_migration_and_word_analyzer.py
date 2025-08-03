#!/usr/bin/env python3
"""
Enhanced Word Analyzer with Migration Validation
Unified analyzer that includes migration validation and improved word analysis
"""

import argparse
import sys
from typing import Dict, List, Optional, Tuple

from migration_utils import get_migrations_directory
from validate_migrations import MigrationValidator


class EnhancedAnalyzer:
    """
    Enhanced analyzer that combines word analysis with migration validation
    """

    def __init__(self, migrations_dir: Optional[str] = None):
        self.migrations_dir = migrations_dir or get_migrations_directory()
        self.validation_results = None

    def run_migration_validation(self, show_details: bool = True) -> bool:
        """Run migration validation first"""
        if show_details:
            print("🔍 MIGRATION VALIDATION")
            print("=" * 80)

        validator = MigrationValidator(self.migrations_dir, update_files=False)
        success = validator.run_validation()

        if success:
            self.validation_results = {
                "errors": validator.errors,
                "warnings": validator.warnings,
            }

            if show_details:
                if validator.errors:
                    print(f"\n❌ MIGRATION ERRORS ({len(validator.errors)}):")
                    for i, error in enumerate(validator.errors, 1):  # Show all errors
                        print(f"  {i}. {error}")

                if validator.warnings:
                    print(f"\n⚠️  MIGRATION WARNINGS ({len(validator.warnings)}):")
                    for i, warning in enumerate(
                        validator.warnings, 1
                    ):  # Show all warnings
                        print(f"  {i}. {warning}")

                if not validator.errors and not validator.warnings:
                    print("\n✅ All migration validations passed!")

                print("\n" + "=" * 80)

        return success and len(validator.errors) == 0  # Only proceed if no errors

    def analyze_language(
        self, language: str, top_n: int = 1000, show_details: bool = True
    ) -> List[Tuple[str, float, str, str]]:
        """Analyze a specific language"""
        if show_details:
            print(f"\n🔍 {language.upper()} WORD ANALYSIS")
            print("=" * 80)

        # Import and create the appropriate analyzer
        if language == "de":
            from german_analyzer import GermanWordAnalyzer

            analyzer = GermanWordAnalyzer(self.migrations_dir)
        elif language == "en":
            from english_analyzer import EnglishWordAnalyzer

            analyzer = EnglishWordAnalyzer(self.migrations_dir)
        elif language == "es":
            from spanish_analyzer import SpanishWordAnalyzer

            analyzer = SpanishWordAnalyzer(self.migrations_dir)
        else:
            raise ValueError(f"Unsupported language: {language}")

        # Run analysis
        recommendations = analyzer.analyze(top_n=top_n, show_details=show_details)

        return recommendations

    def run_complete_analysis(
        self,
        languages: List[str] = None,
        top_n: int = 1000,
        validate_first: bool = True,
    ) -> Dict[str, List]:
        """Run complete analysis with optional migration validation"""
        if languages is None:
            languages = ["de", "en", "es"]

        results = {}

        # Step 1: Migration validation (if requested)
        if validate_first:
            print("🚀 STARTING ENHANCED WORD ANALYSIS WITH MIGRATION VALIDATION")
            print("=" * 80)

            validation_success = self.run_migration_validation(show_details=True)

            if not validation_success:
                print(
                    "\n⚠️  Migration validation found issues, but continuing with word analysis..."
                )
                print("=" * 80)

        # Step 2: Word analysis for each language
        for language in languages:
            try:
                recommendations = self.analyze_language(
                    language, top_n=top_n, show_details=True
                )
                results[language] = recommendations
            except Exception as e:
                print(f"\n❌ Error analyzing {language}: {e}")
                results[language] = []

        # Step 3: Summary
        self._print_summary(results)

        return results

    def _print_summary(self, results: Dict[str, List]):
        """Print overall summary"""
        print("\n🎯 OVERALL ANALYSIS SUMMARY")
        print("=" * 80)

        total_recommendations = 0
        for language, recommendations in results.items():
            lang_name = {"de": "German", "en": "English", "es": "Spanish"}.get(
                language, language
            )
            print(f"📊 {lang_name}: {len(recommendations)} words recommended")
            total_recommendations += len(recommendations)

        print(
            f"\n🔍 Total words recommended across all languages: {total_recommendations}"
        )

        if self.validation_results:
            print(
                f"🔧 Migration validation: {len(self.validation_results['errors'])} errors, {len(self.validation_results['warnings'])} warnings"
            )

        print("\n" + "=" * 80)


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(
        description="Enhanced word analysis with migration validation for LinguaQuiz"
    )

    parser.add_argument(
        "--languages",
        nargs="+",
        choices=["de", "en", "es"],
        default=["de", "en", "es"],
        help="Languages to analyze (default: all)",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=1000,
        help="Number of top frequency words to analyze (default: 1000)",
    )
    parser.add_argument(
        "--skip-validation", action="store_true", help="Skip migration validation step"
    )
    parser.add_argument(
        "--migrations-dir",
        type=str,
        default=None,
        help="Path to migrations directory (default: auto-detect)",
    )

    args = parser.parse_args()

    # Create analyzer
    analyzer = EnhancedAnalyzer(migrations_dir=args.migrations_dir)

    # Run analysis
    results = analyzer.run_complete_analysis(
        languages=args.languages,
        top_n=args.top_n,
        validate_first=not args.skip_validation,
    )

    # Exit with error code if no results
    if not results:
        sys.exit(1)

    print(f"\n🎉 Enhanced analysis complete!")


if __name__ == "__main__":
    main()
