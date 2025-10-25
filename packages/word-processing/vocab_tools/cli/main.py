"""
Main CLI entry point for LinguaQuiz Vocabulary Analysis Tools.

Provides a unified interface for vocabulary analysis and migration validation
across all supported languages.
"""

import argparse
import json
from pathlib import Path
import sys
from typing import Any

from ..languages.english_vocab import EnglishVocabularyAnalyzer
from ..languages.german_vocab import GermanVocabularyAnalyzer
from ..languages.spanish_vocab import SpanishVocabularyAnalyzer
from ..storage.results_tracker import get_results_tracker
from ..validation.migration_validator import MigrationValidator

# No more hardcoded constants needed


class VocabularyToolsCLI:
    """
    Main CLI interface for vocabulary analysis tools.

    Provides unified access to vocabulary analysis and validation
    functionality across all supported languages.
    """

    def __init__(self):
        self.analyzers = {
            "en": EnglishVocabularyAnalyzer,
            "de": GermanVocabularyAnalyzer,
            "es": SpanishVocabularyAnalyzer,
        }
        self.results_tracker = get_results_tracker()

    def create_parser(self) -> argparse.ArgumentParser:
        """Create the main argument parser."""
        parser = argparse.ArgumentParser(
            prog="vocab-tools",
            description="LinguaQuiz Vocabulary Analysis and Validation Tools",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
Examples:
  # Analyze vocabulary gaps for all languages
  vocab-tools analyze

  # Analyze specific languages
  vocab-tools analyze --languages en de

  # Validate migration files
  vocab-tools validate

  # Combined analysis and validation
  vocab-tools full-analysis

  # Get analysis results in JSON format
  vocab-tools analyze --output json --languages en

Requirements:
  This tool requires spaCy core models for proper linguistic analysis.
  Install the required models with:
    python -m spacy download en_core_web_sm    # English
    python -m spacy download de_core_news_sm   # German
    python -m spacy download es_core_news_sm   # Spanish
            """,
        )

        subparsers = parser.add_subparsers(dest="command", help="Available commands")

        # Analyze command
        analyze_parser = subparsers.add_parser("analyze", help="Analyze vocabulary gaps for specified languages")
        self._setup_analyze_parser(analyze_parser)

        # Validate command
        validate_parser = subparsers.add_parser("validate", help="Validate migration files for data integrity")
        self._setup_validate_parser(validate_parser)

        # Full analysis command (analysis + validation)
        full_parser = subparsers.add_parser("full-analysis", help="Run complete analysis with validation")
        self._setup_full_analysis_parser(full_parser)

        # Results history command
        history_parser = subparsers.add_parser("history", help="View analysis results history")
        self._setup_history_parser(history_parser)

        # Results summary command
        summary_parser = subparsers.add_parser("summary", help="Generate summary report of all analyses")
        self._setup_summary_parser(summary_parser)

        return parser

    def _add_common_arguments(self, parser: argparse.ArgumentParser, include_output: bool = True):
        """Add common arguments to a subparser."""
        parser.add_argument(
            "--migrations-dir",
            type=str,
            help="Path to migrations directory (default: auto-detect)",
        )
        if include_output:
            parser.add_argument(
                "--output",
                choices=["text", "json"],
                default="text",
                help="Output format (default: text)",
            )

    def _add_analysis_arguments(self, parser: argparse.ArgumentParser):
        """Add analysis-specific arguments to a subparser."""
        parser.add_argument(
            "--languages",
            nargs="+",
            choices=["en", "de", "es"],
            default=["en", "de", "es"],
            help="Languages to analyze (default: all)",
        )
        parser.add_argument(
            "--top-n",
            type=int,
            default=1000,
            help="Number of top frequency words to analyze (default: 1000)",
        )

    def _setup_analyze_parser(self, parser: argparse.ArgumentParser):
        """Set up the analyze command parser."""
        self._add_common_arguments(parser)
        self._add_analysis_arguments(parser)
        parser.add_argument(
            "--start-rank",
            type=int,
            default=1,
            help="Starting rank for frequency analysis (1-based, default: 1)",
        )
        parser.add_argument(
            "--limit-analysis",
            type=int,
            help="Limit analysis to first N words per language",
        )
        parser.add_argument(
            "--hide-details",
            action="store_true",
            help="Hide detailed category breakdown",
        )
        parser.add_argument("--save-results", type=str, help="Save results to specified file")

    def _setup_validate_parser(self, parser: argparse.ArgumentParser):
        """Set up the validate command parser."""
        self._add_common_arguments(parser)
        parser.add_argument("--brief", action="store_true", help="Show brief report (less detailed)")
        parser.add_argument("--errors-only", action="store_true", help="Only show errors, not warnings")

    def _setup_full_analysis_parser(self, parser: argparse.ArgumentParser):
        """Set up the full analysis command parser."""
        self._add_common_arguments(parser)
        self._add_analysis_arguments(parser)
        parser.add_argument(
            "--skip-validation",
            action="store_true",
            help="Skip migration validation step",
        )

    def _setup_history_parser(self, parser: argparse.ArgumentParser):
        """Set up the history command parser."""
        parser.add_argument(
            "--limit",
            type=int,
            default=10,
            help="Number of recent runs to show (default: 10)",
        )
        parser.add_argument(
            "--run-type",
            choices=["analysis", "validation", "full-analysis"],
            help="Filter by run type",
        )
        parser.add_argument(
            "--language",
            choices=["en", "de", "es"],
            help="Show trends for specific language",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=30,
            help="Number of days for trend analysis (default: 30)",
        )
        self._add_common_arguments(parser, include_output=True)

    def _setup_summary_parser(self, parser: argparse.ArgumentParser):
        """Set up the summary command parser."""
        self._add_common_arguments(parser, include_output=True)

    def run_analyze(self, args: argparse.Namespace) -> dict[str, Any]:
        """
        Run vocabulary analysis for specified languages.

        Args:
            args: Parsed command line arguments

        Returns:
            Dictionary containing analysis results
        """
        if args.output == "text":
            print("🚀 STARTING VOCABULARY ANALYSIS")
            print("=" * 80)

        migrations_dir = Path(args.migrations_dir) if args.migrations_dir else None
        results = {}
        vocabulary_results = {}

        for language in args.languages:
            try:
                if args.output == "text":
                    print(f"\n📊 Analyzing {language.upper()} vocabulary...")

                # Create analyzer
                analyzer_class = self.analyzers[language]
                analyzer = analyzer_class(migrations_dir)

                # Run analysis
                result = analyzer.analyze_vocabulary_gaps(
                    top_n=args.top_n,
                    start_rank=getattr(args, "start_rank", 1),
                    limit_analysis=args.limit_analysis,
                    show_progress=True,
                )

                # Store results for return using to_dict method
                results[language] = result.to_dict()

                # Store raw results for tracking
                vocabulary_results[language] = result

                # Print results if text output
                if args.output == "text":
                    analyzer.print_analysis_results(result, show_details=not args.hide_details)

            except Exception as e:
                if args.output == "text":
                    print(f"\n❌ Error analyzing {language}: {e}")
                results[language] = {"error": str(e)}

        # Store analysis results to history
        if vocabulary_results:
            config = {
                "top_n": args.top_n,
                "limit_analysis": args.limit_analysis,
                "languages": args.languages,
                "migrations_dir": str(migrations_dir) if migrations_dir else None,
            }

            self.results_tracker.store_analysis_run(
                run_type="analysis",
                config=config,
                vocabulary_results=vocabulary_results,
            )

        return results

    def run_validate(self, args: argparse.Namespace) -> dict[str, Any]:
        """
        Run migration validation.

        Args:
            args: Parsed command line arguments

        Returns:
            Dictionary containing validation results
        """
        if args.output == "text":
            print("🔍 STARTING MIGRATION VALIDATION")
            print("=" * 80)

        migrations_dir = Path(args.migrations_dir) if args.migrations_dir else None
        validator = MigrationValidator(migrations_directory=migrations_dir)

        # Run validation
        result = validator.validate_all_migrations()

        # Filter results if requested
        if args.errors_only:
            result.issues = [i for i in result.issues if i.severity == "error"]

        # Print report if text output (skip for silent JSON mode)
        if args.output == "text":
            validator.print_validation_report(result, detailed=not args.brief)

        # Store validation results to history
        config = {
            "migrations_dir": str(migrations_dir) if migrations_dir else None,
            "errors_only": args.errors_only,
        }

        self.results_tracker.store_analysis_run(run_type="validation", config=config, validation_result=result)

        return result.to_dict()

    def run_full_analysis(self, args: argparse.Namespace) -> dict[str, Any]:
        if args.output == "text":
            print("🚀 STARTING FULL VOCABULARY ANALYSIS")
            print("=" * 80)

        results = {"validation": None, "analysis": {}}
        migrations_dir = Path(args.migrations_dir) if args.migrations_dir else None

        # Step 1: Run validation (if not skipped)
        if not args.skip_validation:
            if args.output == "text":
                print("\n🔍 Phase 1: Migration Validation")
                print("-" * 40)

            validator = MigrationValidator(migrations_directory=migrations_dir)
            validation_result = validator.validate_all_migrations()

            if args.output == "text":
                validator.print_validation_report(validation_result, detailed=False)

            results["validation"] = validation_result.to_dict()

            if not validation_result.is_valid and args.output == "text":
                print("\n⚠️  Migration validation found errors, but continuing with analysis...")

            # Store validation results
            config = {
                "migrations_dir": str(migrations_dir) if migrations_dir else None,
                "strict": True,
                "errors_only": False,
            }
            self.results_tracker.store_analysis_run(
                run_type="validation",
                config=config,
                validation_result=validation_result,
            )

        # Step 2: Run vocabulary analysis
        if args.output == "text":
            print("\n📊 Phase 2: Vocabulary Analysis")
            print("-" * 40)

        vocabulary_results = {}
        analysis_results = {}

        for language in args.languages:
            try:
                if args.output == "text":
                    print(f"\n📊 Analyzing {language.upper()} vocabulary...")

                analyzer_class = self.analyzers[language]
                analyzer = analyzer_class(migrations_dir)

                result = analyzer.analyze_vocabulary_gaps(
                    top_n=args.top_n,
                    start_rank=1,
                    limit_analysis=None,
                    show_progress=True,
                )

                analysis_results[language] = result.to_dict()
                vocabulary_results[language] = result

                if args.output == "text":
                    analyzer.print_analysis_results(result, show_details=True)

            except Exception as e:
                if args.output == "text":
                    print(f"\n❌ Error analyzing {language}: {e}")
                analysis_results[language] = {"error": str(e)}

        results["analysis"] = analysis_results

        # Store analysis results
        if vocabulary_results:
            config = {
                "top_n": args.top_n,
                "limit_analysis": None,
                "languages": args.languages,
                "migrations_dir": str(migrations_dir) if migrations_dir else None,
            }
            self.results_tracker.store_analysis_run(
                run_type="analysis",
                config=config,
                vocabulary_results=vocabulary_results,
            )

        # Print summary
        if args.output == "text":
            self._print_full_analysis_summary(results)

        return results

    def _print_full_analysis_summary(self, results: dict[str, Any]):
        """Print summary of full analysis results."""
        print("\n🎯 FULL ANALYSIS SUMMARY")
        print("=" * 80)

        # Validation summary
        if results["validation"]:
            val = results["validation"]
            status = "✅ PASSED" if val["is_valid"] else "❌ FAILED"
            print(f"🔍 Validation: {status} ({val['error_count']} errors, {val['warning_count']} warnings)")
        else:
            print("🔍 Validation: SKIPPED")

        # Analysis summary with detailed breakdown
        analysis = results["analysis"]
        total_existing_words = 0
        total_analyzed_words = 0
        total_recommendations = 0

        print("\n📚 Vocabulary Database Size:")
        for lang, result in analysis.items():
            if "error" not in result:
                existing = result["total_existing_words"]
                analyzed = result["total_analyzed_words"]
                recs = result["recommendation_count"]

                print(f"   • {lang.upper()}: {existing:,} existing words")
                total_existing_words += existing
                total_analyzed_words += analyzed
                total_recommendations += recs
            else:
                print(f"   • {lang.upper()}: ERROR - {result['error']}")

        print("\n🔍 Gap Analysis Results:")
        for lang, result in analysis.items():
            if "error" not in result:
                analyzed = result["total_analyzed_words"]
                recs = result["recommendation_count"]
                print(f"   • {lang.upper()}: {analyzed:,} missing words analyzed → {recs:,} recommendations")

        print("\n📊 TOTALS:")
        print(f"   • Total existing vocabulary: {total_existing_words:,} words")
        print(f"   • Total missing words analyzed: {total_analyzed_words:,} words")
        print(f"   • Total recommendations for addition: {total_recommendations:,} words")
        print("=" * 80)

    def run_history(self, args: argparse.Namespace) -> dict[str, Any]:
        """
        Show analysis results history.

        Args:
            args: Parsed command line arguments

        Returns:
            Dictionary containing history results
        """
        if args.output == "text":
            print("📚 ANALYSIS HISTORY")
            print("=" * 80)

        if args.language:
            # Show language-specific trends
            trends = self.results_tracker.get_language_trends(args.language, args.days)

            if args.output == "text":
                print(f"\n📊 {args.language.upper()} Language Trends ({args.days} days)")
                print("-" * 50)
                if trends["runs_found"] > 0:
                    print(f"• Analysis runs found: {trends['runs_found']}")
                    if trends["latest_stats"]:
                        stats = trends["latest_stats"]
                        print(f"• Latest recommendations: {stats['recommendations']:,}")
                        print(f"• Latest existing words: {stats['existing_words']:,}")
                        print(f"• Latest timestamp: {stats['timestamp'][:19]}")
                else:
                    print("• No recent analysis runs found")

            return trends

        if args.run_type:
            # Show runs of specific type
            runs = self.results_tracker.get_runs_by_type(args.run_type)
            recent_runs = runs[-args.limit :] if runs else []

            if args.output == "text":
                print(f"\n📋 Recent {args.run_type.title()} Runs (showing last {len(recent_runs)})")
                print("-" * 60)
                for run in reversed(recent_runs):
                    timestamp = run["timestamp"][:19].replace("T", " ")
                    summary = run.get("summary", {})
                    total_recs = summary.get("total_recommendations", 0)
                    languages = summary.get("languages_analyzed", [])
                    lang_str = ", ".join(languages) if languages else "N/A"
                    print(f"• {timestamp} | {total_recs:4,} recs | langs: {lang_str}")

            return {"run_type": args.run_type, "runs": recent_runs}

        # Show general recent history
        recent_runs = self.results_tracker.get_recent_runs(args.limit)

        if args.output == "text":
            print(f"\n📋 Recent Analysis Runs (showing last {len(recent_runs)})")
            print("-" * 60)
            for run in reversed(recent_runs):
                timestamp = run["timestamp"][:19].replace("T", " ")
                run_type = run["run_type"].ljust(12)
                summary = run.get("summary", {})
                total_recs = summary.get("total_recommendations", 0)
                print(f"• {timestamp} | {run_type} | {total_recs:4,} recommendations")

        return {"recent_runs": recent_runs}

    def run_summary(self, args: argparse.Namespace) -> dict[str, Any]:
        """
        Generate summary report of all analyses.

        Args:
            args: Parsed command line arguments

        Returns:
            Dictionary containing summary report
        """
        if args.output == "text":
            print("📈 ANALYSIS SUMMARY REPORT")
            print("=" * 80)

        summary = self.results_tracker.generate_summary_report()

        if args.output == "text":
            if "message" in summary:
                print(f"\n{summary['message']}")
                return summary

            print("\n📊 Overall Statistics:")
            print(f"• Total analysis runs: {summary['total_analysis_runs']}")
            print(f"• Validation success rate: {summary['validation_success_rate']}")
            print(f"• Languages analyzed: {', '.join(summary['languages_analyzed'])}")

            print("\n📋 Run Types:")
            for run_type, count in summary["run_types"].items():
                print(f"• {run_type}: {count} runs")

            print("\n🎯 Latest Recommendations by Language:")
            for lang, recs in summary["latest_recommendations_by_language"].items():
                print(f"• {lang.upper()}: {recs:,} recommendations")

            print("\n📚 Recent Activity:")
            for run in summary["recent_runs"][-5:]:  # Show last 5
                timestamp = run["timestamp"][:19].replace("T", " ")
                run_type = run["run_type"].ljust(10)
                total_recs = run["total_recommendations"]
                print(f"• {timestamp} | {run_type} | {total_recs:4,} recommendations")

            print(f"\n📁 Results stored in: {summary['results_file']}")

        return summary

    def save_results(self, results: dict[str, Any], filepath: str):
        """Save results to a file."""
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            print(f"\n💾 Results saved to: {filepath}")
        except Exception as e:
            print(f"\n❌ Error saving results: {e}")

    def run(self):
        """Main entry point for the CLI."""
        parser = self.create_parser()

        # Show help if no command provided
        if len(sys.argv) == 1:
            parser.print_help()
            return

        args = parser.parse_args()

        try:
            # Route to appropriate command handler
            if args.command == "analyze":
                results = self.run_analyze(args)

                # Output results
                if args.output == "json":
                    print(json.dumps(results, indent=2, ensure_ascii=False))

                # Save results if requested
                if hasattr(args, "save_results") and args.save_results:
                    self.save_results(results, args.save_results)

            elif args.command == "validate":
                results = self.run_validate(args)

                if args.output == "json":
                    print(json.dumps(results, indent=2, ensure_ascii=False))

                # Exit with error code if validation failed
                if not results["is_valid"]:
                    sys.exit(1)

            elif args.command == "full-analysis":
                results = self.run_full_analysis(args)

                if args.output == "json":
                    print(json.dumps(results, indent=2, ensure_ascii=False))

            elif args.command == "history":
                results = self.run_history(args)

                if args.output == "json":
                    print(json.dumps(results, indent=2, ensure_ascii=False))

            elif args.command == "summary":
                results = self.run_summary(args)

                if args.output == "json":
                    print(json.dumps(results, indent=2, ensure_ascii=False))

            else:
                parser.print_help()

        except KeyboardInterrupt:
            print("\n\n⚠️  Analysis interrupted by user.")
            sys.exit(1)
        except Exception as e:
            print(f"\n❌ Unexpected error: {e}")
            sys.exit(1)


def main():
    """CLI entry point."""
    cli = VocabularyToolsCLI()
    cli.run()


if __name__ == "__main__":
    main()
