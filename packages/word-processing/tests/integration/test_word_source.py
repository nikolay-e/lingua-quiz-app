"""
Integration tests for WordSource implementations.

Tests verify all WordSource implementations:
1. MigrationFileSource - parsing migration JSON files
2. FrequencySource - wordfreq library integration
3. SubtitleFrequencySource - CSV subtitle frequency files
4. CustomListSource - user-provided files (JSON, CSV, TXT)
"""

import json

import pytest

from vocab_tools.core.word_source import (
    CustomListSource,
    FrequencySource,
    MigrationFileSource,
    SubtitleFrequencySource,
)


@pytest.fixture
def temp_data_dir(tmp_path):
    """Create temporary data directory structure."""
    data_dir = tmp_path / "data"
    data_dir.mkdir()
    return data_dir


@pytest.fixture
def temp_migrations_dir(tmp_path):
    """Create temporary migrations directory for testing."""
    migrations_dir = tmp_path / "migrations" / "data" / "vocabulary"
    migrations_dir.mkdir(parents=True)
    return migrations_dir


@pytest.fixture
def sample_migration_file(temp_migrations_dir):
    """Create sample migration file."""
    data = {
        "word_pairs": [
            {
                "source_word": "casa",
                "target_word": "дом",
                "source_example": "Mi casa es bonita.",
                "target_example": "Мой дом красивый.",
            },
            {
                "source_word": "libro",
                "target_word": "книга",
                "source_example": "Leo un libro.",
                "target_example": "Я читаю книгу.",
            },
        ]
    }

    file_path = temp_migrations_dir / "spanish-russian-a1.json"
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    return file_path


class TestMigrationFileSource:
    """Test MigrationFileSource for parsing migration files."""

    def test_get_words_from_migration_file(self, sample_migration_file, temp_migrations_dir):
        """Verify MigrationFileSource returns words from migration files."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")
        words = list(source.get_words())

        assert len(words) == 2
        assert words[0].text == "casa"
        assert words[1].text == "libro"

    def test_get_language_code(self, sample_migration_file, temp_migrations_dir):
        """Verify get_language_code returns correct language."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")

        assert source.get_language_code() == "es"

    def test_word_metadata_includes_translation_info(self, sample_migration_file, temp_migrations_dir):
        """Verify words include translation metadata."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")
        words = list(source.get_words())

        assert words[0].metadata is not None
        assert "target_word" in words[0].metadata
        assert words[0].metadata["target_word"] == "дом"

    def test_count_method(self, sample_migration_file, temp_migrations_dir):
        """Verify count() returns correct number of words."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")

        assert source.count() == 2

    def test_empty_migrations_directory(self, temp_migrations_dir):
        """Verify handling of empty migrations directory."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")
        words = list(source.get_words())

        assert len(words) == 0


class TestFrequencySource:
    """Test FrequencySource for wordfreq library integration."""

    def test_get_words_from_wordfreq(self):
        """Verify FrequencySource returns words from wordfreq."""
        source = FrequencySource("es", top_n=10, start_rank=1)
        words = list(source.get_words())

        assert len(words) == 10
        assert all(word.text for word in words)

    def test_get_language_code(self):
        """Verify get_language_code returns correct language."""
        source = FrequencySource("es", top_n=10)

        assert source.get_language_code() == "es"

    def test_word_metadata_includes_rank(self):
        """Verify words include rank metadata."""
        source = FrequencySource("es", top_n=5, start_rank=1)
        words = list(source.get_words())

        assert words[0].metadata is not None
        assert "rank" in words[0].metadata
        assert words[0].metadata["rank"] == 1
        assert words[1].metadata["rank"] == 2

    def test_start_rank_offset(self):
        """Verify start_rank parameter skips first N words."""
        source_from_1 = FrequencySource("es", top_n=1, start_rank=1)
        source_from_10 = FrequencySource("es", top_n=1, start_rank=10)

        words_1 = list(source_from_1.get_words())
        words_10 = list(source_from_10.get_words())

        assert words_1[0].text != words_10[0].text
        assert words_10[0].metadata["rank"] == 10

    def test_count_matches_top_n(self):
        """Verify count() returns top_n value."""
        source = FrequencySource("es", top_n=15)

        assert source.count() == 15


class TestSubtitleFrequencySource:
    """Test SubtitleFrequencySource for CSV subtitle files."""

    @pytest.fixture
    def subtitle_frequency_file(self, temp_data_dir):
        """Create sample subtitle frequency file."""
        freq_dir = temp_data_dir / "subtitle_frequencies"
        freq_dir.mkdir()

        file_path = freq_dir / "es_50k.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("que 1234567\n")
            f.write("no 987654\n")
            f.write("es 876543\n")
            f.write("la 765432\n")
            f.write("el 654321\n")

        return file_path

    def test_get_words_from_subtitle_file(self, subtitle_frequency_file, temp_data_dir):
        """Verify SubtitleFrequencySource reads CSV files."""
        source = SubtitleFrequencySource("es", top_n=3, start_rank=1)
        source._data_dir = temp_data_dir / "subtitle_frequencies"
        source._words = None

        words = list(source.get_words())

        assert len(words) == 3
        assert words[0].text == "que"
        assert words[1].text == "no"
        assert words[2].text == "es"

    def test_get_language_code(self, subtitle_frequency_file, temp_data_dir):
        """Verify get_language_code returns correct language."""
        source = SubtitleFrequencySource("es", top_n=5)
        source._data_dir = temp_data_dir / "subtitle_frequencies"

        assert source.get_language_code() == "es"

    def test_word_metadata_includes_rank(self, subtitle_frequency_file, temp_data_dir):
        """Verify words include rank metadata."""
        source = SubtitleFrequencySource("es", top_n=3, start_rank=1)
        source._data_dir = temp_data_dir / "subtitle_frequencies"

        words = list(source.get_words())

        assert words[0].metadata["rank"] == 1
        assert words[1].metadata["rank"] == 2
        assert words[2].metadata["rank"] == 3

    def test_start_rank_offset(self, subtitle_frequency_file, temp_data_dir):
        """Verify start_rank skips first N words."""
        source = SubtitleFrequencySource("es", top_n=2, start_rank=3)
        source._data_dir = temp_data_dir / "subtitle_frequencies"

        words = list(source.get_words())

        assert len(words) == 2
        assert words[0].text == "es"
        assert words[0].metadata["rank"] == 3

    def test_missing_file_raises_error(self, temp_data_dir):
        """Verify missing subtitle file raises FileNotFoundError."""
        source = SubtitleFrequencySource("xx", top_n=10)
        source._data_dir = temp_data_dir / "subtitle_frequencies"

        with pytest.raises(FileNotFoundError):
            list(source.get_words())


class TestCustomListSource:
    """Test CustomListSource for user-provided files."""

    def test_read_plain_text_file(self, temp_data_dir):
        """Verify CustomListSource reads plain text files."""
        file_path = temp_data_dir / "words.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("casa\n")
            f.write("libro\n")
            f.write("mesa\n")

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 3
        assert words[0].text == "casa"
        assert words[1].text == "libro"
        assert words[2].text == "mesa"

    def test_read_json_array(self, temp_data_dir):
        """Verify CustomListSource reads JSON array files."""
        file_path = temp_data_dir / "words.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(["casa", "libro", "mesa"], f)

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 3
        assert words[0].text == "casa"

    def test_read_json_with_words_key(self, temp_data_dir):
        """Verify CustomListSource reads JSON with 'words' key."""
        file_path = temp_data_dir / "words.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump({"words": ["casa", "libro", "mesa"]}, f)

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 3
        assert words[0].text == "casa"

    def test_read_csv_file(self, temp_data_dir):
        """Verify CustomListSource reads CSV files."""
        file_path = temp_data_dir / "words.csv"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("word,frequency\n")
            f.write("casa,1000\n")
            f.write("libro,800\n")
            f.write("mesa,600\n")

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 3
        assert words[0].text == "casa"

    def test_get_language_code(self, temp_data_dir):
        """Verify get_language_code returns correct language."""
        file_path = temp_data_dir / "words.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("test\n")

        source = CustomListSource(file_path, "de")

        assert source.get_language_code() == "de"

    def test_word_source_includes_file_metadata(self, temp_data_dir):
        """Verify words include source file metadata."""
        file_path = temp_data_dir / "words.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("casa\n")

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert "words.txt" in words[0].source

    def test_empty_file(self, temp_data_dir):
        """Verify handling of empty files."""
        file_path = temp_data_dir / "empty.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("")

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 0

    def test_json_dict_objects(self, temp_data_dir):
        """Verify CustomListSource handles JSON with dict objects."""
        file_path = temp_data_dir / "words.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(
                [
                    {"word": "casa", "frequency": 1000},
                    {"word": "libro", "frequency": 800},
                ],
                f,
            )

        source = CustomListSource(file_path, "es")
        words = list(source.get_words())

        assert len(words) == 2
        assert words[0].text == "casa"
        assert words[0].metadata["frequency"] == 1000


class TestWordSourceCount:
    """Test WordSource.count() method."""

    def test_count_migration_source(self, sample_migration_file, temp_migrations_dir):
        """Verify count() works for MigrationFileSource."""
        source = MigrationFileSource(temp_migrations_dir.parent.parent, "es")

        assert source.count() == 2

    def test_count_frequency_source(self):
        """Verify count() works for FrequencySource."""
        source = FrequencySource("es", top_n=25)

        assert source.count() == 25

    def test_count_custom_source(self, temp_data_dir):
        """Verify count() works for CustomListSource."""
        file_path = temp_data_dir / "words.txt"
        with open(file_path, "w", encoding="utf-8") as f:
            f.write("word1\nword2\nword3\n")

        source = CustomListSource(file_path, "es")

        assert source.count() == 3
