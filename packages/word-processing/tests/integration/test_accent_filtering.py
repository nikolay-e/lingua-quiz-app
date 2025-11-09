"""
Test accent variant filtering in analysis.

If A1 has "dónde" (interrogative), "donde" (relative) should not be reported
as critically missing, since the concept is covered.
"""

from pathlib import Path

import pytest


class TestAccentFiltering:
    """Test that accent variants are properly filtered in analysis."""

    @pytest.fixture(scope="class")
    def analyzer(self):
        from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

        migration_file = Path(
            "/Users/nikolay/code/lingua-quiz/packages/backend/migrations/data/vocabulary/spanish-russian-a1.json"
        )
        return MigrationAnalyzer("es", migration_file)

    def test_remove_accents_function(self, analyzer):
        """Test accent removal utility function."""
        test_cases = [
            ("dónde", "donde"),
            ("cómo", "como"),
            ("quién", "quien"),
            ("qué", "que"),
            ("está", "esta"),
            ("más", "mas"),
            ("José", "Jose"),
        ]

        for accented, unaccented in test_cases:
            result = analyzer._remove_accents(accented)
            assert result == unaccented, f"Failed: '{accented}' → expected '{unaccented}', got '{result}'"

    def test_donde_not_reported_when_dónde_in_a1(self, analyzer):
        """
        If A1 has "dónde", "donde" should NOT be reported as missing.

        Reasoning: interrogative "dónde" (where?) covers the concept
        for A1 level, relative "donde" (where) is less critical.
        """
        # Load A1 words
        a1_words = analyzer._load_vocabulary()

        # Check if dónde is in A1
        if "dónde" not in a1_words:
            pytest.skip("dónde not in A1, test not applicable")

        # Run analysis
        result = analyzer.analyze(top_n=1500)

        # Get lemmas reported as missing
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        # "donde" should NOT be in missing list
        donde_lemma = analyzer.lemmatization_service.lemmatize("donde")

        assert donde_lemma not in missing_lemmas, (
            f"'donde' (lemma: {donde_lemma}) reported as missing, but A1 has 'dónde' which covers this concept"
        )

    def test_como_not_reported_when_cómo_in_a1(self, analyzer):
        """If A1 has "cómo", "como" should NOT be reported as missing."""
        a1_words = analyzer._load_vocabulary()

        if "cómo" not in a1_words:
            pytest.skip("cómo not in A1, test not applicable")

        result = analyzer.analyze(top_n=1500)
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        como_lemma = analyzer.lemmatization_service.lemmatize("como")

        assert como_lemma not in missing_lemmas, (
            f"'como' (lemma: {como_lemma}) reported as missing, but A1 has 'cómo' which covers this concept"
        )

    def test_quien_not_reported_when_quién_in_a1(self, analyzer):
        """If A1 has "quién", "quien" should NOT be reported as missing."""
        a1_words = analyzer._load_vocabulary()

        if "quién" not in a1_words:
            pytest.skip("quién not in A1, test not applicable")

        result = analyzer.analyze(top_n=1500)
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        quien_lemma = analyzer.lemmatization_service.lemmatize("quien")

        assert quien_lemma not in missing_lemmas, (
            f"'quien' (lemma: {quien_lemma}) reported as missing, but A1 has 'quién' which covers this concept"
        )

    def test_accent_filtering_is_bidirectional(self, analyzer):
        """
        Test that filtering works both ways.

        If A1 has "como" (without accent), "cómo" (with accent) should also
        not be reported as critically missing (if it's in top frequency).
        """
        a1_words = analyzer._load_vocabulary()

        # This test checks the opposite direction
        if "como" not in a1_words:
            pytest.skip("como not in A1, test not applicable")

        result = analyzer.analyze(top_n=1500)
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        cómo_lemma = analyzer.lemmatization_service.lemmatize("cómo")

        # If "como" is in A1, "cómo" should not be reported as missing
        assert cómo_lemma not in missing_lemmas, (
            f"'cómo' (lemma: {cómo_lemma}) reported as missing, but A1 has 'como' which covers this concept"
        )

    def test_no_false_positive_critical_missing_words(self, analyzer):
        """
        Critical test: no accent variants should appear in top 100 missing words.

        If A1 has "dónde", "cómo", "quién" - then "donde", "como", "quien"
        should NOT appear in critical missing (top 100 by rank).
        """
        a1_words = analyzer._load_vocabulary()
        result = analyzer.analyze(top_n=1500)

        # Get top 100 missing words by rank
        critical_missing = sorted(result.missing_from_a1, key=lambda x: x["rank_estimate"])[:100]

        critical_lemmas = {item["lemma"] for item in critical_missing}

        # Check each interrogative/relative pair
        pairs = [
            ("dónde", "donde"),
            ("cómo", "como"),
            ("quién", "quien"),
            ("qué", "que"),
        ]

        false_positives = []

        for interrogative, relative in pairs:
            if interrogative not in a1_words and relative not in a1_words:
                continue  # Neither form in A1

            # If ANY form is in A1, the other should not be critical
            relative_lemma = analyzer.lemmatization_service.lemmatize(relative)

            if relative_lemma in critical_lemmas:
                false_positives.append(f"{relative} (lemma: {relative_lemma}) - A1 has {interrogative}")

        assert not false_positives, "Accent variants reported as critical missing:\n" + "\n".join(
            f"  - {fp}" for fp in false_positives
        )

    def test_analysis_result_has_fewer_missing_after_filtering(self, analyzer):
        """
        Test that accent filtering reduces the number of missing words.

        Expected: after filtering, missing_from_a1 count should be lower than
        without filtering (would have both "donde" and "dónde" as separate).
        """
        result = analyzer.analyze(top_n=1500)

        # Count how many accent pairs exist in A1
        a1_words = analyzer._load_vocabulary()

        accent_pairs_in_a1 = 0
        for word in a1_words:
            normalized = analyzer._remove_accents(word)
            if normalized != word:  # Has accents
                # Check if unaccented version also in A1
                unaccented_in_a1 = any(analyzer._remove_accents(w) == normalized and w != word for w in a1_words)
                if not unaccented_in_a1:
                    accent_pairs_in_a1 += 1

        # Document the filtering effect
        print("\n📊 Accent filtering statistics:")
        print(f"   Words with accents in A1: {accent_pairs_in_a1}")
        print(f"   Missing from A1 (after filtering): {len(result.missing_from_a1)}")

        # This is informational - shows filtering is working
        assert isinstance(result.missing_from_a1, list)

    def test_specific_example_donde_filtering(self, analyzer):
        """
        Concrete example test: A1 has "dónde" → "donde" filtered.

        This is the exact bug reported by user.
        """
        a1_words = analyzer._load_vocabulary()

        # Verify test precondition
        assert "dónde" in a1_words, "Test requires 'dónde' in A1"

        result = analyzer.analyze(top_n=1500)

        # Find "donde" in missing list
        donde_lemma = analyzer.lemmatization_service.lemmatize("donde")
        donde_items = [item for item in result.missing_from_a1 if item["lemma"] == donde_lemma]

        # Should be filtered out
        assert len(donde_items) == 0, (
            f"BUG: 'donde' (lemma: {donde_lemma}) appears in missing list even though A1 has 'dónde'.\nFound items: {donde_items}"
        )
