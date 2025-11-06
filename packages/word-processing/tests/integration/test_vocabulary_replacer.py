"""Integration tests for VocabularyReplacer."""

import json
from pathlib import Path
import tempfile
from unittest.mock import patch

import pytest
from vocab_tools.maintenance.vocabulary_replacer import VocabularyReplacer


@pytest.fixture
def mock_analysis_data():
    """Mock data for _get_detailed_analysis() that simulates vocabulary analysis results."""
    return [
        # Common words (rank < 1000) - IN_VOCABULARY
        {
            "lemma": "casa",
            "forms": ["casa", "casas"],
            "rank": 150,
            "zipf": 5.8,
            "status": "IN_VOCABULARY",
        },
        {
            "lemma": "estar",
            "forms": ["estar", "estoy", "está", "estás"],
            "rank": 20,
            "zipf": 6.5,
            "status": "IN_VOCABULARY",
        },
        {
            "lemma": "tener",
            "forms": ["tener", "tengo", "tiene", "tienes"],
            "rank": 35,
            "zipf": 6.3,
            "status": "IN_VOCABULARY",
        },
        {
            "lemma": "libro",
            "forms": ["libro", "libros"],
            "rank": 450,
            "zipf": 5.2,
            "status": "IN_VOCABULARY",
        },
        {
            "lemma": "mesa",
            "forms": ["mesa", "mesas"],
            "rank": 680,
            "zipf": 4.9,
            "status": "IN_VOCABULARY",
        },
        # Very rare words (rank > 10000) - IN_VOCABULARY (should be removed)
        {
            "lemma": "rareword1",
            "forms": ["rareword1"],
            "rank": 15000,
            "zipf": 2.1,
            "status": "IN_VOCABULARY",
        },
        {
            "lemma": "rareword2",
            "forms": ["rareword2"],
            "rank": 20000,
            "zipf": 1.8,
            "status": "IN_VOCABULARY",
        },
        # Low priority rare words (rank 8000-10000) - IN_VOCABULARY
        {
            "lemma": "lowpriority1",
            "forms": ["lowpriority1"],
            "rank": 8500,
            "zipf": 3.1,
            "status": "IN_VOCABULARY",
        },
        # Missing critical words (rank < 100) - MISSING (should be added)
        {
            "lemma": "lo",
            "forms": ["lo", "los"],
            "rank": 15,
            "zipf": 6.7,
            "status": "MISSING",
        },
        {
            "lemma": "un",
            "forms": ["un", "una", "unos", "unas"],
            "rank": 8,
            "zipf": 6.9,
            "status": "MISSING",
        },
        {
            "lemma": "se",
            "forms": ["se"],
            "rank": 12,
            "zipf": 6.8,
            "status": "MISSING",
        },
        {
            "lemma": "quiero",
            "forms": ["quiero", "querer", "quiere"],
            "rank": 45,
            "zipf": 6.2,
            "status": "MISSING",
        },
        # Additional missing words for testing
        {
            "lemma": "pero",
            "forms": ["pero"],
            "rank": 25,
            "zipf": 6.4,
            "status": "MISSING",
        },
        {
            "lemma": "muy",
            "forms": ["muy"],
            "rank": 55,
            "zipf": 6.1,
            "status": "MISSING",
        },
    ]


class TestVocabularyReplacer:
    """Test VocabularyReplacer for replacing rare words with high-frequency words."""

    def test_initialize_replacer(self, test_migration_file_with_rare_words):
        """Test initializing replacer with valid language and level."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        assert replacer.language_code == "es"
        assert replacer.level == "A1"
        assert replacer.config is not None

    def test_identify_rare_words_spanish_a1(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test identifying rare words in Spanish A1."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            rare_words = replacer.identify_rare_words(min_rank=10000, additional_threshold=8000)

        assert "very_rare" in rare_words
        assert "low_priority" in rare_words
        assert isinstance(rare_words["very_rare"], list)
        assert isinstance(rare_words["low_priority"], list)

        assert len(rare_words["very_rare"]) > 0
        assert len(rare_words["low_priority"]) > 0

    def test_identify_missing_words_spanish_a1(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test identifying missing high-frequency words in Spanish A1."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            missing_words = replacer.identify_missing_words(max_rank=1000)

        assert isinstance(missing_words, list)
        assert len(missing_words) > 0

        for word in missing_words:
            assert "lemma" in word
            assert "forms" in word
            assert "rank" in word
            assert "zipf" in word
            assert word["rank"] <= 1000

        assert missing_words == sorted(missing_words, key=lambda x: x["rank"])

    def test_missing_words_include_critical(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test that critical missing words (lo, un, se, quiero) are identified."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            missing_words = replacer.identify_missing_words(max_rank=100)

        missing_lemmas = {w["lemma"] for w in missing_words}

        critical_words = {"lo", "un", "se", "quiero"}
        found_critical = missing_lemmas & critical_words

        assert len(found_critical) > 0, f"Expected to find critical words, found: {missing_lemmas}"

    def test_generate_replacement_plan(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test generating complete replacement plan."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan(remove_rank=10000, add_rank=1000)

        assert "remove" in plan
        assert "add" in plan
        assert "stats" in plan

        assert isinstance(plan["remove"], list)
        assert isinstance(plan["add"], list)
        assert len(plan["remove"]) > 0
        assert len(plan["add"]) > 0

        assert plan["stats"]["words_to_remove"] == len(plan["remove"])
        assert plan["stats"]["words_to_add"] == len(plan["add"])
        assert plan["stats"]["very_rare_count"] > 0
        assert plan["stats"]["low_priority_count"] >= 0

    def test_replacement_plan_no_duplicates_in_remove(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test that removal list has no duplicates."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan()

        remove_list = plan["remove"]

        assert len(remove_list) == len(set(remove_list)), "Removal list contains duplicates"

    def test_execute_replacement_dry_run(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test executing replacement in dry-run mode (no file changes)."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan(remove_rank=10000, add_rank=100)
            result = replacer.execute_replacement(plan, dry_run=True)

        assert result["dry_run"] is True
        assert result["removed_count"] > 0
        assert result["added_count"] > 0
        assert result["final_count"] == (result["original_count"] - result["removed_count"] + result["added_count"])

    def test_execute_replacement_with_output_file(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test executing replacement with custom output file."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan(remove_rank=10000, add_rank=50)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            output_file = Path(tmp.name)

        try:
            result = replacer.execute_replacement(plan, output_file=output_file, dry_run=False)

            assert result["dry_run"] is False
            assert output_file.exists()
            assert result["output_file"] == str(output_file)

            with open(output_file) as f:
                data = json.load(f)

            word_pairs = data.get("word_pairs", [])
            assert len(word_pairs) == result["final_count"]

            placeholders = [entry for entry in word_pairs if entry.get("target_word") == "[PLACEHOLDER]"]
            assert len(placeholders) == result["added_count"]

        finally:
            output_file.unlink(missing_ok=True)

    def test_replacement_adds_metadata(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test that new entries include metadata (rank, zipf, forms)."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan(remove_rank=10000, add_rank=50)

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            output_file = Path(tmp.name)

        try:
            replacer.execute_replacement(plan, output_file=output_file, dry_run=False)

            with open(output_file) as f:
                data = json.load(f)

            word_pairs = data.get("word_pairs", [])
            placeholders = [entry for entry in word_pairs if entry.get("target_word") == "[PLACEHOLDER]"]

            for entry in placeholders:
                assert "metadata" in entry
                assert "rank" in entry["metadata"]
                assert "zipf" in entry["metadata"]
                assert "forms" in entry["metadata"]

        finally:
            output_file.unlink(missing_ok=True)

    def test_replacement_preserves_existing_entries(self, test_migration_file_with_rare_words, mock_analysis_data):
        """Test that replacement preserves non-removed entries."""
        replacer = VocabularyReplacer(language_code="es", level="a1", migration_file=test_migration_file_with_rare_words)

        with open(test_migration_file_with_rare_words) as f:
            original_json = json.load(f)

        original_pairs = original_json.get("word_pairs", [])

        with patch.object(replacer, "_get_detailed_analysis", return_value=mock_analysis_data):
            plan = replacer.generate_replacement_plan(remove_rank=10000, add_rank=50)

        words_to_remove = {w.lower() for w in plan["remove"]}

        expected_preserved = [entry for entry in original_pairs if entry.get("source_word", "").lower() not in words_to_remove]

        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as tmp:
            output_file = Path(tmp.name)

        try:
            result = replacer.execute_replacement(plan, output_file=output_file, dry_run=False)

            with open(output_file) as f:
                new_json = json.load(f)

            new_pairs = new_json.get("word_pairs", [])
            preserved = [entry for entry in new_pairs if entry.get("target_word") != "[PLACEHOLDER]"]

            assert len(preserved) == len(expected_preserved)
            assert result["removed_count"] == len(original_pairs) - len(preserved)

        finally:
            output_file.unlink(missing_ok=True)

    def test_invalid_language_code(self):
        """Test that invalid language code raises error."""
        with pytest.raises(KeyError):
            VocabularyReplacer(language_code="invalid", level="a1")

    def test_missing_migration_file(self):
        """Test handling of missing migration file."""
        replacer = VocabularyReplacer(language_code="es", level="z9")

        with pytest.raises(FileNotFoundError):
            replacer.identify_rare_words()
