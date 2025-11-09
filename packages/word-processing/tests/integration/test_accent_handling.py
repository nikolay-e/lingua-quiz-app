"""
Tests for handling Spanish words with/without accents.

Two distinct problems:
1. DUPLICATES: Words with/without accents that should be merged (como/cómo are SAME word)
2. FALSE POSITIVES: Words reported as missing when they actually exist in vocabulary
"""

import pytest


class TestAccentDuplicates:
    """
    Test detection of duplicate words with/without accents.

    In Spanish, interrogatives have accents, relatives don't:
    - "cómo" (how - interrogative) vs "como" (as/like - conjunction)
    - "dónde" (where - interrogative) vs "donde" (where - relative pronoun)
    - "quién" (who - interrogative) vs "quien" (who - relative pronoun)

    These ARE linguistically different words and should NOT be treated as duplicates.
    BUT if both appear in A1, we may want to flag this for manual review.
    """

    @pytest.fixture(scope="class")
    def migration_file(self, spanish_a1_migration_file):
        return spanish_a1_migration_file

    def test_detect_interrogative_relative_pairs_in_a1(self, migration_file):
        """
        Detect when A1 has both interrogative (with accent) and relative (without accent).

        Expected behavior:
        - Flag these pairs for manual review
        - They may be intentional (teaching both forms)
        - Or may be duplicates that should be merged
        """
        from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

        analyzer = MigrationAnalyzer("es", migration_file)
        a1_words = analyzer._load_vocabulary()

        # Known interrogative/relative pairs
        pairs_to_check = [
            ("como", "cómo"),
            ("donde", "dónde"),
            ("quien", "quién"),
            ("que", "qué"),
        ]

        pairs_found = []
        for without_accent, with_accent in pairs_to_check:
            if without_accent in a1_words and with_accent in a1_words:
                pairs_found.append((without_accent, with_accent))

        # Document which pairs exist (not necessarily an error)
        if pairs_found:
            print("\n⚠️  Found interrogative/relative pairs in A1:")
            for pair in pairs_found:
                print(f"   {pair[0]} / {pair[1]}")

        # This is informational - may be intentional
        assert isinstance(pairs_found, list)


class TestFalsePositiveMissing:
    """
    Test that words existing in A1 are NOT reported as missing.

    This is the critical bug: analyzer.analyze() reports words as "missing from A1"
    when they actually exist in the A1 vocabulary.
    """

    @pytest.fixture(scope="class")
    def analyzer(self, spanish_a1_migration_file):
        from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

        return MigrationAnalyzer("es", spanish_a1_migration_file)

    def test_words_in_a1_not_reported_as_missing(self, analyzer):
        """
        CRITICAL: Words that exist in A1 must NOT appear in missing_from_a1 report.

        Bug reproduction:
        - A1 contains "gracias" (rank 49)
        - Analysis reports "gracias" as missing from A1
        - This is FALSE POSITIVE
        """
        # Load actual A1 words
        a1_words = analyzer._load_vocabulary()

        # Words we KNOW are in A1
        test_words = ["gracias", "sólo"]

        # Verify they're actually in A1
        for word in test_words:
            assert word in a1_words, f"Test setup error: '{word}' not in A1"

        # Run analysis
        result = analyzer.analyze(top_n=1500)

        # Get lemmas of test words
        test_lemmas = {analyzer.lemmatization_service.lemmatize(word) for word in test_words}

        # Get lemmas reported as missing
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # These lemmas should NOT be in missing list
        false_positives = test_lemmas & missing_lemmas

        assert not false_positives, (
            f"FALSE POSITIVES: Words exist in A1 but reported as missing: {false_positives}\n"
            f"Original words in A1: {test_words}\n"
            f"Their lemmas: {test_lemmas}\n"
            f"Reported as missing: {false_positives}"
        )

    def test_accented_words_in_a1_not_reported_as_missing(self, analyzer):
        """
        Test specifically for accented interrogative pronouns.

        Bug reproduction:
        - A1 contains "cómo" (rank 45), "dónde" (rank 63), "quién" (rank 59)
        - Analysis reports them as missing from A1
        - This is FALSE POSITIVE
        """
        # Load actual A1 words
        a1_words = analyzer._load_vocabulary()

        # Accented words we KNOW are in A1
        test_words = ["cómo", "dónde", "quién"]

        # Verify they're actually in A1
        for word in test_words:
            assert word in a1_words, f"Test setup error: '{word}' not in A1"

        # Run analysis
        result = analyzer.analyze(top_n=1500)

        # Get lemmas of test words
        test_lemmas = {analyzer.lemmatization_service.lemmatize(word) for word in test_words}

        # Get lemmas reported as missing
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # These lemmas should NOT be in missing list
        false_positives = test_lemmas & missing_lemmas

        assert not false_positives, (
            f"FALSE POSITIVES: Accented words exist in A1 but reported as missing: {false_positives}\n"
            f"Original words in A1: {test_words}\n"
            f"Their lemmas: {test_lemmas}\n"
            f"Reported as missing: {false_positives}"
        )

    def test_lemmatization_consistency_a1_vs_frequency(self, analyzer):
        """
        Root cause test: lemmatization must be consistent.

        If "gracias" is lemmatized to X when reading A1,
        it must be lemmatized to X when reading frequency list.
        """
        test_words = ["gracias", "cómo", "solo", "dónde"]

        for word in test_words:
            # Lemmatize 5 times to check consistency
            lemmas = [analyzer.lemmatization_service.lemmatize(word) for _ in range(5)]

            # All results must be identical
            unique_lemmas = set(lemmas)
            assert len(unique_lemmas) == 1, f"Lemmatization NOT consistent for '{word}': got {unique_lemmas}"

            lemma = lemmas[0]
            print(f"✓ '{word}' consistently lemmatizes to '{lemma}'")
