"""Replace rare words in vocabulary with high-frequency missing words."""

import json
import tempfile
from pathlib import Path

from ..analysis.full_report_generator import FullReportGenerator
from ..config.config_loader import get_config_loader


class VocabularyReplacer:
    """Replace rare words with high-frequency missing words in migration files."""

    def __init__(self, language_code: str, level: str, migration_file: Path | None = None):
        """Initialize vocabulary replacer.

        Args:
            language_code: Language code (e.g., 'es', 'de', 'en')
            level: CEFR level (e.g., 'a1', 'a2', 'b1')
            migration_file: Optional custom migration file path (for testing)
        """
        self.language_code = language_code
        self.level = level.upper()
        config_loader = get_config_loader()
        self.config = config_loader.config

        self.migration_file = migration_file or self._get_migration_file()
        self.report_generator = FullReportGenerator(
            language_code=language_code, migration_file_path=self.migration_file
        )

    def _get_migration_file(self) -> Path:
        """Get path to migration file."""
        lang_name = self.config.languages[self.language_code].name.lower()
        filename = f"{lang_name}-russian-{self.level.lower()}.json"

        migrations_dir = Path(__file__).parents[3] / "backend" / "migrations" / "data" / "vocabulary"
        return migrations_dir / filename

    def _get_detailed_analysis(self) -> list[dict]:
        """Generate detailed word-by-word analysis using FullReportGenerator.

        Returns:
            List of word dictionaries with status, rank, forms, zipf, etc.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir)
            self.report_generator.generate_full_report(output_dir)

            json_file = output_dir / f"{self.language_code}_vocabulary_detailed.json"
            if json_file.exists():
                with open(json_file) as f:
                    return json.load(f)

            raise RuntimeError("Failed to generate detailed analysis report")

    def identify_rare_words(self, min_rank: int = 10000, additional_threshold: int = 8000) -> dict[str, list[str]]:
        """Identify rare words to remove based on frequency rank.

        Args:
            min_rank: Minimum rank for 'very rare' classification (default: 10000)
            additional_threshold: Rank threshold for additional low-priority words (default: 8000)

        Returns:
            Dictionary with 'very_rare' and 'low_priority' lists of word forms
        """
        analysis = self._get_detailed_analysis()

        very_rare = []
        low_priority = []

        for word_data in analysis:
            if word_data["status"] == "IN_VOCABULARY":
                rank = word_data["rank"]
                forms = word_data["forms"]

                if rank > min_rank:
                    very_rare.extend(forms)
                elif rank > additional_threshold:
                    low_priority.extend(forms)

        return {"very_rare": very_rare, "low_priority": low_priority}

    def identify_missing_words(self, max_rank: int = 1000) -> list[dict]:
        """Identify high-frequency missing words to add.

        Args:
            max_rank: Maximum rank to consider (default: 1000)

        Returns:
            List of missing word dictionaries with lemma, forms, rank, zipf
        """
        analysis = self._get_detailed_analysis()

        missing_words = []
        for word_data in analysis:
            if word_data["status"] == "MISSING" and word_data["rank"] <= max_rank:
                missing_words.append(
                    {
                        "lemma": word_data["lemma"],
                        "forms": word_data["forms"],
                        "rank": word_data["rank"],
                        "zipf": word_data["zipf"],
                    }
                )

        return sorted(missing_words, key=lambda x: x["rank"])

    def generate_replacement_plan(self, remove_rank: int = 10000, add_rank: int = 1000) -> dict:
        """Generate replacement plan showing what to remove and add.

        Args:
            remove_rank: Rank threshold for removal (default: 10000)
            add_rank: Rank threshold for additions (default: 1000)

        Returns:
            Dictionary with 'remove' and 'add' lists
        """
        rare_words = self.identify_rare_words(min_rank=remove_rank)
        missing_words = self.identify_missing_words(max_rank=add_rank)

        all_remove = rare_words["very_rare"] + rare_words["low_priority"]
        unique_remove = sorted(set(all_remove))

        return {
            "remove": unique_remove,
            "add": missing_words,
            "stats": {
                "words_to_remove": len(unique_remove),
                "words_to_add": len(missing_words),
                "very_rare_count": len(rare_words["very_rare"]),
                "low_priority_count": len(rare_words["low_priority"]),
            },
        }

    def execute_replacement(self, plan: dict, output_file: Path | None = None, dry_run: bool = True) -> dict:
        """Execute replacement plan on migration file.

        Args:
            plan: Replacement plan from generate_replacement_plan()
            output_file: Output file path (default: overwrites original)
            dry_run: If True, only show changes without writing (default: True)

        Returns:
            Dictionary with execution results and statistics
        """
        migration_file = self.migration_file

        with open(migration_file) as f:
            data = json.load(f)

        translations = data.get("translations", [])
        original_count = len(translations)
        words_to_remove = {w.lower() for w in plan["remove"]}

        filtered_pairs = [
            entry for entry in translations if entry.get("source_word", "").lower() not in words_to_remove
        ]

        removed_count = original_count - len(filtered_pairs)

        new_entries = []
        for word in plan["add"]:
            new_entries.append(
                {
                    "source_word": word["lemma"],
                    "target_word": "[PLACEHOLDER]",
                    "example_source": "",
                    "example_target": "",
                    "metadata": {
                        "rank": word["rank"],
                        "zipf": word["zipf"],
                        "forms": word["forms"],
                    },
                }
            )

        final_pairs = filtered_pairs + new_entries

        result = {
            "original_count": original_count,
            "removed_count": removed_count,
            "added_count": len(new_entries),
            "final_count": len(final_pairs),
            "dry_run": dry_run,
        }

        if not dry_run:
            output_path = output_file or migration_file
            data["translations"] = final_pairs
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            result["output_file"] = str(output_path)

        return result
