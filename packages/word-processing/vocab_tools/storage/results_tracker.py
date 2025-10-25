"""
Results tracker for vocabulary analysis tools.

Stores all analysis results in a single JSON file for historical tracking
and trend analysis.
"""

import datetime
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

from ..core.vocabulary_analyzer import VocabularyAnalysisResult
from ..validation.migration_validator import ValidationResult


@dataclass
class AnalysisRun:
    """Complete analysis run record."""

    timestamp: str
    run_type: str  # 'analysis', 'validation', 'full-analysis'
    config: Dict[str, Any]
    validation_result: Optional[Dict[str, Any]] = None
    vocabulary_results: Dict[str, Any] = None
    summary: Dict[str, Any] = None


class ResultsTracker:
    """
    Tracks and stores all analysis results in a single JSON file.

    Provides functionality to store results, retrieve historical data,
    and generate trend reports.
    """

    def __init__(self, results_file: Optional[Path] = None):
        """Initialize the results tracker."""
        if results_file is None:
            # Store in the word_processing_scripts directory
            script_dir = Path(__file__).parent.parent.parent
            results_file = script_dir / "analysis_history.json"

        self.results_file = results_file
        self._ensure_results_file_exists()

    def _ensure_results_file_exists(self):
        """Create results file if it doesn't exist."""
        if not self.results_file.exists():
            self._save_results([])

    def _load_results(self) -> List[Dict[str, Any]]:
        """Load all results from file."""
        try:
            with open(self.results_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, FileNotFoundError) as e:
            if isinstance(e, json.JSONDecodeError):
                print(f"Warning: Corrupted history file {self.results_file}, starting fresh")
            return []

    def _save_results(self, results: List[Dict[str, Any]]):
        """Save all results to file."""
        with open(self.results_file, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)

    def store_analysis_run(
        self,
        run_type: str,
        config: Dict[str, Any],
        validation_result: Optional[ValidationResult] = None,
        vocabulary_results: Optional[Dict[str, VocabularyAnalysisResult]] = None,
    ) -> str:
        """
        Store a complete analysis run.

        Args:
            run_type: Type of run ('analysis', 'validation', 'full-analysis')
            config: Configuration parameters used
            validation_result: Migration validation results
            vocabulary_results: Vocabulary analysis results by language

        Returns:
            Timestamp of the stored run
        """
        timestamp = datetime.datetime.now().isoformat()

        # Convert validation result
        validation_data = None
        if validation_result:
            validation_data = {
                "is_valid": validation_result.is_valid,
                "total_entries_checked": validation_result.total_entries_checked,
                "files_validated": validation_result.files_validated,
                "error_count": validation_result.error_count,
                "warning_count": validation_result.warning_count,
                "duplicate_count": 0,  # Simplified validation tracking
                "issues": [
                    {
                        "severity": i.severity,
                        "category": i.category,
                        "message": i.message,
                        "file_name": i.file_name,
                        "entry_id": i.entry_id,
                    }
                    for i in validation_result.issues  # All issues with full details
                ],
            }

        # Convert vocabulary results
        vocab_data = {}
        total_recommendations = 0

        if vocabulary_results:
            for lang, result in vocabulary_results.items():
                if hasattr(result, "error"):
                    vocab_data[lang] = {"error": result.error}
                else:
                    # Store ALL words from ALL categories (this includes everything)
                    words_by_category = {}
                    for category, words in result.categories.items():
                        words_by_category[category] = [
                            {
                                "word": w.word,
                                "frequency": w.frequency,
                                "pos_tag": w.pos_tag,
                                "reason": w.reason,
                                "recommended": w.is_recommended,
                            }
                            for w in words  # Store ALL words in each category
                        ]

                    vocab_data[lang] = {
                        "existing_words": result.total_existing_words,
                        "analyzed_words": result.total_analyzed_words,
                        "words": words_by_category,  # ALL words organized by category
                        "recommendation_count": result.get_recommendation_count(),
                    }
                    total_recommendations += result.get_recommendation_count()

        # Create streamlined run record
        run_record = {
            "timestamp": timestamp,
            "run_type": run_type,
            "config": config,
            "validation": validation_data,
            "vocabulary": vocab_data,
        }

        # Add a compact summary for quick history displays
        run_record["summary"] = {
            "total_recommendations": total_recommendations,
            "languages_analyzed": list(vocab_data.keys()),
        }

        # Load existing results and append
        all_results = self._load_results()
        all_results.append(run_record)

        # Keep only last 500 runs to store comprehensive history
        if len(all_results) > 500:
            all_results = all_results[-500:]

        self._save_results(all_results)

        print(f"📁 Analysis results stored to: {self.results_file}")
        return timestamp

    def get_recent_runs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get the most recent analysis runs."""
        all_results = self._load_results()
        return all_results[-limit:] if all_results else []

    def get_runs_by_type(self, run_type: str) -> List[Dict[str, Any]]:
        """Get all runs of a specific type."""
        all_results = self._load_results()
        return [r for r in all_results if r.get("run_type") == run_type]

    def get_language_trends(self, language: str, days: int = 30) -> Dict[str, Any]:
        """Get trends for a specific language over time."""
        cutoff_date = datetime.datetime.now() - datetime.timedelta(days=days)
        all_results = self._load_results()

        relevant_runs = []
        for run in all_results:
            try:
                run_date = datetime.datetime.fromisoformat(run["timestamp"])
                vocab_data = run.get("vocabulary", {})
                if run_date >= cutoff_date and vocab_data.get(language):
                    relevant_runs.append(run)
            except (ValueError, KeyError):
                continue

        if not relevant_runs:
            return {"language": language, "runs": 0, "trend": "No recent data"}

        # Extract metrics
        recommendations_over_time = []

        for run in relevant_runs:
            vocab_data = run.get("vocabulary", {})
            vocab_result = vocab_data[language]
            if "error" not in vocab_result:
                # Use pre-calculated recommendation count for efficiency
                rec_count = vocab_result.get("recommendation_count", 0)

                recommendations_over_time.append(
                    {
                        "timestamp": run["timestamp"],
                        "recommendations": rec_count,
                        "existing_words": vocab_result.get(
                            "existing_words",
                            vocab_result.get("total_existing_words", 0),
                        ),
                    }
                )

        return {
            "language": language,
            "days_analyzed": days,
            "runs_found": len(relevant_runs),
            "metrics_over_time": recommendations_over_time,
            "latest_stats": (recommendations_over_time[-1] if recommendations_over_time else None),
        }

    def generate_summary_report(self) -> Dict[str, Any]:
        """Generate a comprehensive summary report."""
        all_results = self._load_results()

        if not all_results:
            return {"message": "No analysis runs found"}

        # Overall statistics
        total_runs = len(all_results)
        run_types = {}
        languages_analyzed = set()
        validation_runs = 0
        passed_validations = 0

        recent_runs = self.get_recent_runs(5)

        for run in all_results:
            run_type = run["run_type"]
            run_types[run_type] = run_types.get(run_type, 0) + 1

            if run.get("vocabulary"):
                languages_analyzed.update(run["vocabulary"].keys())

            if run.get("validation"):
                validation_runs += 1
                if run["validation"]["is_valid"]:
                    passed_validations += 1

        # Latest recommendation counts by language
        latest_recommendations = {}
        for lang in languages_analyzed:
            for run in reversed(all_results):
                if run.get("vocabulary", {}).get(lang):
                    vocab_result = run["vocabulary"][lang]
                    if "error" not in vocab_result:
                        if "recommendation_count" in vocab_result:
                            latest_recommendations[lang] = vocab_result["recommendation_count"]
                        else:
                            # Fallback: compute from stored words
                            count = 0
                            for words in vocab_result.get("words", {}).values():
                                count += sum(1 for w in words if w.get("recommended"))
                            latest_recommendations[lang] = count
                        break

        return {
            "total_analysis_runs": total_runs,
            "run_types": run_types,
            "languages_analyzed": list(languages_analyzed),
            "validation_success_rate": (f"{passed_validations}/{validation_runs}" if validation_runs > 0 else "N/A"),
            "latest_recommendations_by_language": latest_recommendations,
            "recent_runs": [
                {
                    "timestamp": run["timestamp"],
                    "run_type": run["run_type"],
                    "languages": list(run.get("vocabulary", {}).keys()),
                    "total_recommendations": run.get("summary", {}).get("total_recommendations", 0),
                }
                for run in recent_runs
            ],
            "results_file": str(self.results_file),
        }

    def create_backup(self, backup_dir: Optional[Path] = None) -> Path:
        """
        Create a timestamped backup of the results file.

        Args:
            backup_dir: Directory to store backup (default: same as results file)

        Returns:
            Path to the created backup file
        """
        import datetime

        if backup_dir is None:
            backup_dir = self.results_file.parent

        # Create backup filename with timestamp
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_filename = f"{self.results_file.stem}_backup_{timestamp}.json"
        backup_path = backup_dir / backup_filename

        # Copy current results to backup
        all_results = self._load_results()
        with open(backup_path, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)

        print(f"💾 Backup created: {backup_path}")
        return backup_path

    def clear_results(self, create_backup: bool = True):
        """
        Clear all stored results (use with caution).

        Args:
            create_backup: Whether to create a backup before clearing
        """
        if create_backup:
            self.create_backup()

        self._save_results([])
        print(f"🗑️  All results cleared from {self.results_file}")

    def export_results(self, export_file: Path):
        """Export all results to a different file."""
        all_results = self._load_results()

        with open(export_file, "w", encoding="utf-8") as f:
            json.dump(all_results, f, indent=2, ensure_ascii=False)

        print(f"📤 Results exported to: {export_file}")


# Global tracker instance
_results_tracker = None


def get_results_tracker(results_file: Optional[Path] = None) -> ResultsTracker:
    """Get the global results tracker instance."""
    global _results_tracker
    if _results_tracker is None:
        _results_tracker = ResultsTracker(results_file)
    return _results_tracker
