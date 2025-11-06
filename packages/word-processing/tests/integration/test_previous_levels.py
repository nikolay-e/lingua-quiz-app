"""
Integration tests for previous CEFR level handling in VocabularyAnalyzer.

Tests verify that vocabulary analysis correctly accounts for words from previous levels:
- A1 should check A0
- A2 should check A0 + A1
- B1 should check A0 + A1 + A2
etc.

This prevents reporting words as "missing" when they already exist in earlier levels.
"""

from pathlib import Path

import pytest
from vocab_tools.analysis.vocabulary_analyzer import VocabularyAnalyzer


class TestPreviousLevelMethods:
    """Test helper methods for previous level handling."""

    @pytest.fixture(scope="class")
    def a1_analyzer(self):
        migration_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json")
        return VocabularyAnalyzer("es", migration_file)

    @pytest.fixture(scope="class")
    def a2_analyzer(self):
        migration_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a2.json")
        return VocabularyAnalyzer("es", migration_file)

    def test_get_level_from_filename_a1(self, a1_analyzer):
        """Test level extraction from A1 filename."""
        level = a1_analyzer._get_level_from_filename()
        assert level == "a1"

    def test_get_level_from_filename_a2(self, a2_analyzer):
        """Test level extraction from A2 filename."""
        level = a2_analyzer._get_level_from_filename()
        assert level == "a2"

    def test_get_previous_levels_a1(self, a1_analyzer):
        """A1 should have A0 as previous level."""
        previous = a1_analyzer._get_previous_levels("a1")
        assert previous == ["a0"]

    def test_get_previous_levels_a2(self, a2_analyzer):
        """A2 should have A0 and A1 as previous levels."""
        previous = a2_analyzer._get_previous_levels("a2")
        assert previous == ["a0", "a1"]

    def test_get_previous_levels_b1(self, a1_analyzer):
        """B1 should have A0, A1, A2 as previous levels."""
        previous = a1_analyzer._get_previous_levels("b1")
        assert previous == ["a0", "a1", "a2"]

    def test_get_previous_levels_hierarchy(self, a1_analyzer):
        """Test complete CEFR hierarchy."""
        hierarchy_tests = [
            ("a0", []),
            ("a1", ["a0"]),
            ("a2", ["a0", "a1"]),
            ("b1", ["a0", "a1", "a2"]),
            ("b2", ["a0", "a1", "a2", "b1"]),
            ("c1", ["a0", "a1", "a2", "b1", "b2"]),
            ("c2", ["a0", "a1", "a2", "b1", "b2", "c1"]),
        ]

        for level, expected_previous in hierarchy_tests:
            previous = a1_analyzer._get_previous_levels(level)
            assert previous == expected_previous, f"Failed for level {level}: expected {expected_previous}, got {previous}"

    def test_load_previous_levels_vocabulary_a1(self, a1_analyzer):
        """A1 should load A0 vocabulary."""
        previous_lemmas = a1_analyzer._load_previous_levels_vocabulary()

        # A0 exists and has words (transliterated words like abogado, abril, etc.)
        assert len(previous_lemmas) > 0, "A0 should contain words"

        # Check some known A0 words are loaded
        # These are transliterated words that should be in A0
        expected_a0_words = ["abogado", "abril", "acto"]

        for word in expected_a0_words:
            # Lemmatize to compare
            lemma = a1_analyzer.lemmatization_service.lemmatize(word)
            assert lemma in previous_lemmas, f"Expected A0 word '{word}' (lemma: {lemma}) to be in previous_lemmas"

    def test_load_previous_levels_vocabulary_a2(self, a2_analyzer):
        """A2 should load A0 + A1 vocabulary."""
        previous_lemmas = a2_analyzer._load_previous_levels_vocabulary()

        # A0 + A1 should have many words
        assert len(previous_lemmas) > 100, "A0 + A1 should contain many words"

        # Check A0 word is included
        a0_word_lemma = a2_analyzer.lemmatization_service.lemmatize("abogado")
        assert a0_word_lemma in previous_lemmas

        # Check A1 word is included (e.g., "estar" is definitely in A1)
        a1_word_lemma = a2_analyzer.lemmatization_service.lemmatize("estar")
        assert a1_word_lemma in previous_lemmas


class TestPreviousLevelsIntegration:
    """Integration tests for analyze() with previous level filtering."""

    @pytest.fixture(scope="class")
    def a1_analyzer(self):
        migration_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json")
        return VocabularyAnalyzer("es", migration_file)

    @pytest.fixture(scope="class")
    def a2_analyzer(self):
        migration_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a2.json")
        return VocabularyAnalyzer("es", migration_file)

    def test_a1_analysis_excludes_a0_words(self, a1_analyzer):
        """
        A1 analysis should NOT report A0 words as missing.

        If a word exists in A0, it should not appear in missing_from_a1 list.
        """
        result = a1_analyzer.analyze(top_n=1500)

        # Get A0 vocabulary
        a0_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a0.json")
        a0_words = a1_analyzer._load_vocabulary_from_file(a0_file)
        a0_lemmas = {a1_analyzer.lemmatization_service.lemmatize(w) for w in a0_words}

        # Get lemmas reported as missing from A1
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # Check: no A0 lemmas should appear in missing_from_a1
        overlap = a0_lemmas & missing_lemmas

        assert not overlap, (
            f"Found {len(overlap)} A0 words reported as missing from A1:\n"
            f"{sorted(overlap)[:10]}\n"
            f"These words exist in A0 and should not be reported as missing."
        )

    def test_a2_analysis_excludes_a0_and_a1_words(self, a2_analyzer):
        """
        A2 analysis should NOT report A0 or A1 words as missing.

        If a word exists in A0 or A1, it should not appear in missing_from_a1 list.
        """
        result = a2_analyzer.analyze(top_n=1500)

        # Get A0 vocabulary
        a0_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a0.json")
        a0_words = a2_analyzer._load_vocabulary_from_file(a0_file)
        a0_lemmas = {a2_analyzer.lemmatization_service.lemmatize(w) for w in a0_words}

        # Get A1 vocabulary
        a1_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json")
        a1_words = a2_analyzer._load_vocabulary_from_file(a1_file)
        a1_lemmas = {a2_analyzer.lemmatization_service.lemmatize(w) for w in a1_words}

        combined_previous = a0_lemmas | a1_lemmas

        # Get lemmas reported as missing from A2
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # Check: no A0 or A1 lemmas should appear in missing_from_a2
        overlap = combined_previous & missing_lemmas

        assert not overlap, (
            f"Found {len(overlap)} A0/A1 words reported as missing from A2:\n"
            f"{sorted(overlap)[:20]}\n"
            f"These words exist in A0 or A1 and should not be reported as missing."
        )

    def test_a2_missing_count_lower_than_without_filtering(self, a2_analyzer):
        """
        A2 missing word count should be significantly lower when previous levels are considered.

        Without filtering: would report ~1500 words missing (entire frequency list)
        With filtering: should report much fewer (only words not in A0+A1+A2)
        """
        result = a2_analyzer.analyze(top_n=1500)

        # A2 is empty (word_pairs: []), but A0+A1 have many words
        # So missing count should be much less than 1500
        missing_count = len(result.missing_from_a1)

        # With A0+A1 having ~1000 words, missing should be around 500-800
        assert missing_count < 1000, f"Expected missing count to be < 1000 after filtering A0+A1, got {missing_count}"

        print("\n📊 A2 Analysis Statistics:")
        print(f"   Missing from A2: {missing_count}")
        print("   (After filtering A0 + A1)")

    def test_accent_variants_filtered_across_levels(self, a2_analyzer):
        """
        Accent variants should be filtered across all levels.

        If A1 has "dónde", A2 analysis should not report "donde" as missing.
        """
        result = a2_analyzer.analyze(top_n=1500)

        # Load A1 to check for accent variants
        a1_file = Path("/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json")
        a1_words = a2_analyzer._load_vocabulary_from_file(a1_file)

        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # Check accent variant pairs
        pairs = [
            ("dónde", "donde"),
            ("cómo", "como"),
            ("quién", "quien"),
            ("qué", "que"),
        ]

        false_positives = []

        for accented, unaccented in pairs:
            if accented in a1_words:
                # If A1 has accented version, unaccented should not be missing
                unaccented_lemma = a2_analyzer.lemmatization_service.lemmatize(unaccented)
                if unaccented_lemma in missing_lemmas:
                    false_positives.append(f"{unaccented} (A1 has {accented})")

        assert not false_positives, "Accent variants reported as missing even though previous level has them:\n" + "\n".join(
            f"  - {fp}" for fp in false_positives
        )
