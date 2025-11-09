"""
Fast unit tests for lemma matching between A1 and frequency lists.

Tests the root cause of false positives without running full analysis.
"""

from pathlib import Path

import pytest


class TestLemmaMatching:
    """Test that lemmas match correctly between A1 and frequency list."""

    @pytest.fixture(scope="class")
    def analyzer(self):
        from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

        migration_file = Path(
            "/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json"
        )
        return MigrationAnalyzer("es", migration_file)

    @pytest.fixture(scope="class")
    def subtitle_index(self):
        from vocab_tools.core.subtitle_frequency_index import get_subtitle_frequency_index

        return get_subtitle_frequency_index("es")

    def test_gracias_lemma_matches(self, analyzer, subtitle_index):
        """
        Test "gracias" specifically.

        Expected:
        - In A1: "gracias" → lemma "gracia"
        - In frequency: "gracias" → lemma "gracia"
        - Should match!
        """
        word = "gracias"

        # Lemmatize using centralized lemmatization service
        lemma = analyzer.lemmatization_service.lemmatize(word)

        print(f"\n'{word}' → '{lemma}'")

        # The lemma should be found in subtitle index
        rank = subtitle_index.get_rank(word)
        print(f"Rank in subtitle index: {rank}")

        # Check if lemma exists in subtitle index directly
        lemma_rank = subtitle_index.get_rank(lemma)
        print(f"Lemma '{lemma}' rank in subtitle index: {lemma_rank}")

        # Both should return same rank
        assert rank == lemma_rank, (
            f"Ranks don't match!\n  Word '{word}' rank: {rank}\n  Lemma '{lemma}' rank: {lemma_rank}"
        )

    def test_como_vs_cómo_lemmas(self, analyzer, subtitle_index):
        """
        Test "como" vs "cómo" - these are different words.

        Expected:
        - "como" → lemma "como"
        - "cómo" → lemma "cómo"
        - Different lemmas, different ranks
        """
        word1 = "como"
        word2 = "cómo"

        lemma1 = analyzer.lemmatization_service.lemmatize(word1)
        lemma2 = analyzer.lemmatization_service.lemmatize(word2)

        rank1 = subtitle_index.get_rank(word1)
        rank2 = subtitle_index.get_rank(word2)

        print(f"\n'{word1}' → '{lemma1}' (rank {rank1})")
        print(f"'{word2}' → '{lemma2}' (rank {rank2})")

        # These should be different
        assert lemma1 != lemma2, "como and cómo should have different lemmas"

    def test_a1_words_have_ranks_in_subtitle_index(self, analyzer, subtitle_index):
        """
        Test that common A1 words exist in subtitle frequency index.

        If they don't exist, rank should be 999999.
        """
        a1_words = analyzer._load_vocabulary()

        # Sample high-frequency words that MUST be in subtitles
        test_words = ["gracias", "solo", "cómo", "hola", "adiós", "sí", "no"]

        missing_words = []

        for word in test_words:
            if word not in a1_words:
                continue

            rank = subtitle_index.get_rank(word)

            if rank == 999999:
                missing_words.append(word)

            print(f"'{word}' → rank {rank}")

        assert not missing_words, f"Common words missing from subtitle index: {missing_words}"

    def test_frequency_list_generation_lemmatizes_correctly(self, analyzer):
        """
        Test that SubtitleFrequencySource lemmatizes words correctly.

        This is where the mismatch might occur.
        """
        from vocab_tools.core.vocabulary_processor import VocabularyProcessor
        from vocab_tools.core.word_source import SubtitleFrequencySource

        # Generate small frequency list with lemmatization
        processor = VocabularyProcessor("es", silent=True)
        source = SubtitleFrequencySource("es", top_n=100, lemmatize=True)

        vocab = processor.process_words(source, filter_inflections=False, target_count=100, collect_stats=False)

        # Check if "gracias" or its lemma is in the list
        words_in_vocab = {word.word for word in vocab.words}
        lemmas_in_vocab = {word.lemma for word in vocab.words}

        print("\nFirst 20 words in frequency list:")
        for i, word in enumerate(vocab.words[:20], 1):
            print(f"  {i}. {word.word} (lemma: {word.lemma})")

        # Check specific test word
        test_word = "gracias"
        test_lemma = analyzer.lemmatization_service.lemmatize(test_word)

        print(f"\nLooking for '{test_word}' (lemma: '{test_lemma}')...")
        print(f"  Word in vocab: {test_word in words_in_vocab}")
        print(f"  Lemma in vocab: {test_lemma in lemmas_in_vocab}")
