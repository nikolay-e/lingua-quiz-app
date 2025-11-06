"""Integration tests for CLI commands."""

import json
from pathlib import Path
import subprocess
import tempfile


class TestAnalyzeCommand:
    """Test analyze CLI command."""

    def test_analyze_spanish_a1(self):
        """Test analyze command for Spanish A1."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["python", "main.py", "analyze", "es-a1", "--format", "all", "--output", tmpdir],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )

            assert result.returncode == 0, f"Command failed: {result.stderr}"
            assert "ANALYSIS COMPLETE" in result.stdout

            # Check generated files
            output_dir = Path(tmpdir)
            assert (output_dir / "es_vocabulary_FULL_REPORT.md").exists()
            assert (output_dir / "es_vocabulary_detailed.json").exists()
            assert (output_dir / "es_vocabulary_analysis.csv").exists()

    def test_analyze_english_a1(self):
        """Test analyze command for English A1."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["python", "main.py", "analyze", "en-a1", "--output", tmpdir],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )

            assert result.returncode == 0, f"Command failed: {result.stderr}"
            assert "ANALYSIS COMPLETE" in result.stdout

    def test_analyze_invalid_language(self):
        """Test analyze with invalid language."""
        result = subprocess.run(
            ["python", "main.py", "analyze", "invalid-a1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode != 0
        assert "Unknown language" in result.stdout or "Unknown language" in result.stderr

    def test_analyze_nonexistent_level(self):
        """Test analyze with non-existent level."""
        result = subprocess.run(
            ["python", "main.py", "analyze", "es-z9"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode != 0
        assert "Unknown CEFR level" in result.stdout or "Invalid" in result.stdout

    def test_analyze_with_custom_top_n(self):
        """Test analyze with custom top-n parameter."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["python", "main.py", "analyze", "es-a1", "--top-n", "500", "--output", tmpdir],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )

            assert result.returncode == 0, f"Command failed: {result.stderr}"

            # Check JSON output exists (structure varies by implementation)
            json_file = Path(tmpdir) / "es_vocabulary_detailed.json"
            assert json_file.exists()
            with open(json_file) as f:
                data = json.load(f)

            # JSON should contain words data
            assert "words" in data or isinstance(data, list)


class TestGenerateCommand:
    """Test generate CLI command."""

    def test_generate_spanish(self):
        """Test generate command for Spanish."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["python", "main.py", "generate", "es", "--top-n", "100", "--output", tmpdir],
                check=False,
                capture_output=True,
                text=True,
                timeout=90,
            )

            assert result.returncode == 0, f"Command failed: {result.stderr}"
            assert "GENERATION COMPLETE" in result.stdout
            assert "Success" in result.stdout

            # Check generated file
            output_file = Path(tmpdir) / "es_frequency_list.json"
            assert output_file.exists()

            with open(output_file) as f:
                data = json.load(f)

            assert data["language"] == "es" or data.get("language_code") == "es"
            # Allow some flexibility in word count (filtering may reduce it)
            assert len(data["words"]) >= 90, f"Expected ~100 words, got {len(data['words'])}"

    def test_generate_all_languages(self):
        """Test generate command for all languages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = subprocess.run(
                ["python", "main.py", "generate", "--top-n", "50", "--output", tmpdir],
                check=False,
                capture_output=True,
                text=True,
                timeout=120,
            )

            assert result.returncode == 0, f"Command failed: {result.stderr}"
            assert "GENERATION COMPLETE" in result.stdout

            # Check EN, ES, DE files exist (RU might fail - no subtitle data)
            output_dir = Path(tmpdir)
            assert (output_dir / "en_frequency_list.json").exists()
            assert (output_dir / "es_frequency_list.json").exists()
            assert (output_dir / "de_frequency_list.json").exists()

    def test_generate_invalid_language(self):
        """Test generate with invalid language."""
        result = subprocess.run(
            ["python", "main.py", "generate", "xx"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode != 0
        assert "Unknown language" in result.stdout or "Unknown language" in result.stderr


class TestFillCommand:
    """Test fill CLI command."""

    def test_fill_empty_file(self):
        """Test fill command with empty migration file."""
        result = subprocess.run(
            ["python", "main.py", "fill", "es-a2"],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )

        # Should succeed even with no placeholders
        assert result.returncode == 0, f"Command failed: {result.stderr}"
        assert "No placeholders" in result.stdout or "placeholders to fill" in result.stdout

    def test_fill_invalid_language(self):
        """Test fill with invalid language."""
        result = subprocess.run(
            ["python", "main.py", "fill", "invalid-a1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )

        assert result.returncode != 0
        assert "Unknown language" in result.stdout or "Invalid" in result.stdout


class TestCLIHelp:
    """Test CLI help and documentation."""

    def test_main_help(self):
        """Test main CLI help."""
        result = subprocess.run(
            ["python", "main.py", "--help"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert result.returncode == 0
        assert "vocabulary" in result.stdout.lower() or "vocab" in result.stdout.lower()
        assert "analyze" in result.stdout
        assert "generate" in result.stdout
        assert "fill" in result.stdout

    def test_analyze_help(self):
        """Test analyze command help."""
        result = subprocess.run(
            ["python", "main.py", "analyze", "--help"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert result.returncode == 0
        assert "--format" in result.stdout
        assert "--top-n" in result.stdout
        assert "--output" in result.stdout

    def test_generate_help(self):
        """Test generate command help."""
        result = subprocess.run(
            ["python", "main.py", "generate", "--help"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert result.returncode == 0
        assert "--top-n" in result.stdout
        assert "--output" in result.stdout

    def test_fill_help(self):
        """Test fill command help."""
        result = subprocess.run(
            ["python", "main.py", "fill", "--help"],
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
        )

        assert result.returncode == 0
        assert "language-level" in result.stdout.lower() or "language_level" in result.stdout.lower()


class TestValidationIntegration:
    """Test validation features through CLI."""

    def test_analyze_detects_empty_translations(self):
        """Test that analyze command detects empty translations."""
        result = subprocess.run(
            ["python", "main.py", "analyze", "es-a1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )

        assert result.returncode == 0
        # Should report validation issues for empty translations
        assert "validation issues" in result.stdout.lower()
        assert "Empty translation" in result.stdout or "Errors" in result.stdout

    def test_analyze_reports_validation_summary(self):
        """Test that analyze shows validation summary."""
        result = subprocess.run(
            ["python", "main.py", "analyze", "es-a1"],
            check=False,
            capture_output=True,
            text=True,
            timeout=90,
        )

        assert result.returncode == 0
        # Should show validation table with errors/warnings
        assert "Errors" in result.stdout
        assert "Warnings" in result.stdout
