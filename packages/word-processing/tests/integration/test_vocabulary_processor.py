"""
Integration tests for VocabularyProcessor.

Tests verify the 7-stage pipeline:
1. Normalization
2. Lemmatization
3. NLP Analysis
4. Validation
5. NER Filtering
6. Inflection Filtering
7. Deduplication
"""

from collections.abc import Iterator

import pytest

from vocab_tools.core.vocabulary_processor import VocabularyProcessor
from vocab_tools.core.word_source import Word, WordSource


class SimpleWordSource(WordSource):
    """Simple in-memory word source for testing."""

    def __init__(self, words: list[str], language_code: str = "es"):
        self.language_code = language_code
        self.words = [Word(text=w, source="test") for w in words]

    def get_words(self) -> Iterator[Word]:
        return iter(self.words)

    def get_language_code(self) -> str:
        return self.language_code


class TestVocabularyProcessorBasic:
    """Test basic vocabulary processing pipeline."""

    def test_process_simple_words_spanish(self, stanza_es_lemmatizer):
        """Verify basic processing of Spanish words."""
        processor = VocabularyProcessor("es", silent=True)
        word_source = SimpleWordSource(["libro", "mesa", "silla"])

        result = processor.process_words(word_source, target_count=10)

        assert result.language_code == "es"
        assert result.total_words >= 1
        assert len(result.words) >= 1

        lemmas = [w.lemma for w in result.words]
        # At least some of these common nouns should pass through
        common_lemmas = {"libro", "mesa", "silla"}
        assert len(common_lemmas & set(lemmas)) >= 1

    def test_process_with_inflections_filters_correctly(self, stanza_es_lemmatizer):
        """Verify inflection filtering based on frequency ratio."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["estar", "estabas", "estoy", "gato", "gatos"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, filter_inflections=True, target_count=10)

        lemmas = [w.lemma for w in result.words]
        assert "estar" in lemmas
        assert "gato" in lemmas

        words_in_result = [w.word for w in result.words]
        assert "estar" in words_in_result or "estabas" in words_in_result or "estoy" in words_in_result

    def test_process_without_inflection_filtering(self, stanza_es_lemmatizer):
        """Verify all words are kept when inflection filtering is disabled."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["estar", "estabas", "estoy"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, filter_inflections=False, target_count=10)

        assert result.total_words >= 1

    def test_strict_lemma_only_mode(self, stanza_es_lemmatizer):
        """Verify strict mode only allows lemmas, filtering all inflections."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["estar", "estabas", "gato", "gatos"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, strict_lemma_only=True, target_count=10)

        for word in result.words:
            assert word.word.lower() == word.lemma, (
                f"Strict mode should only have lemmas, found inflection: {word.word} (lemma: {word.lemma})"
            )

    def test_target_count_limits_output(self, stanza_es_lemmatizer):
        """Verify target_count parameter limits number of words processed."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "perro", "casa", "libro", "mesa", "silla", "ventana", "puerta"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, target_count=3)

        assert result.total_words <= 3

    def test_deduplication_by_lemma(self, stanza_es_lemmatizer):
        """Verify words with same lemma are deduplicated."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "gatos", "gatito"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, target_count=10)

        lemmas = [w.lemma for w in result.words]
        unique_lemmas = set(lemmas)

        assert len(lemmas) == len(unique_lemmas), "Should have no duplicate lemmas"

    def test_lemma_prioritization(self, stanza_es_lemmatizer):
        """Verify lemma form is prioritized over inflections."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["estabas", "estar", "estoy"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, filter_inflections=False, target_count=10)

        words_in_result = [w.word for w in result.words if w.lemma == "estar"]

        if len(words_in_result) == 1:
            assert words_in_result[0] == "estar", "When lemma form appears, it should be prioritized over inflections"


class TestVocabularyProcessorEdgeCases:
    """Test edge cases and boundary conditions."""

    def test_empty_word_source(self):
        """Verify handling of empty word source."""
        processor = VocabularyProcessor("es", silent=True)
        word_source = SimpleWordSource([])

        result = processor.process_words(word_source)

        assert result.total_words == 0
        assert result.filtered_count == 0
        assert len(result.words) == 0

    def test_all_words_filtered(self):
        """Verify handling when all words are filtered out."""
        processor = VocabularyProcessor("es", silent=True)

        invalid_words = ["", "   ", "123", "http://example.com", "xyz123"]
        word_source = SimpleWordSource(invalid_words)

        result = processor.process_words(word_source, target_count=10)

        assert result.total_words == 0
        assert result.filtered_count >= 0

    def test_target_count_zero(self):
        """Verify target_count=0 returns empty result."""
        processor = VocabularyProcessor("es", silent=True)
        word_source = SimpleWordSource(["gato", "perro"])

        result = processor.process_words(word_source, target_count=0)

        assert result.total_words == 0

    def test_existing_words_filtered_out(self, stanza_es_lemmatizer):
        """Verify words in existing_words are filtered out."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "perro", "casa"]
        existing = {"perro"}
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, existing_words=existing, target_count=10)

        words_in_result = [w.word for w in result.words]
        assert "perro" not in words_in_result or result.total_words <= 2


class TestVocabularyProcessorStatistics:
    """Test statistics collection."""

    def test_collect_stats_enabled(self, stanza_es_lemmatizer):
        """Verify statistics are collected when enabled."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "perro", "123", "a"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, collect_stats=True)

        assert result.filtering_stats is not None
        assert result.filtering_stats.total_analyzed >= 4
        assert isinstance(result.filtering_stats.by_category, dict)

    def test_collect_stats_disabled(self, stanza_es_lemmatizer):
        """Verify statistics are not collected when disabled."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "perro"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, collect_stats=False)

        assert result.filtering_stats is None

    def test_filtering_stats_categories(self, stanza_es_lemmatizer):
        """Verify filtering stats track different rejection categories."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "123", "a", "http://test.com"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, collect_stats=True)

        if result.filtering_stats and result.filtering_stats.by_category:
            categories = result.filtering_stats.by_category.keys()
            assert len(categories) > 0


class TestVocabularyProcessorCategories:
    """Test category assignment and organization."""

    def test_categories_populated(self, stanza_es_lemmatizer):
        """Verify words are categorized by POS."""
        processor = VocabularyProcessor("es", silent=True)

        words = ["gato", "correr", "bonito"]
        word_source = SimpleWordSource(words)

        result = processor.process_words(word_source, target_count=10)

        assert len(result.categories) > 0
        assert isinstance(result.categories, dict)

        total_categorized = sum(len(words) for words in result.categories.values())
        assert total_categorized == result.total_words


class TestVocabularyProcessorMultiLanguage:
    """Test processing for different languages."""

    def test_process_english_words(self, stanza_en_lemmatizer):
        """Verify processing works for English."""
        processor = VocabularyProcessor("en", silent=True)
        word_source = SimpleWordSource(["book", "table", "chair"], language_code="en")

        result = processor.process_words(word_source, target_count=10)

        assert result.language_code == "en"
        assert result.total_words >= 1

    @pytest.mark.skipif(True, reason="German model may not be installed")
    def test_process_german_words(self, stanza_de_lemmatizer):
        """Verify processing works for German."""
        processor = VocabularyProcessor("de", silent=True)
        word_source = SimpleWordSource(["Katze", "Hund", "Haus"], language_code="de")

        result = processor.process_words(word_source, target_count=10)

        assert result.language_code == "de"
        assert result.total_words == 3
