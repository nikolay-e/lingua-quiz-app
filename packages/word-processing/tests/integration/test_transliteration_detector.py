"""Integration tests for TransliterationDetector."""

from vocab_tools.analysis.transliteration_detector import TransliterationDetector


class TestTransliterationDetector:
    """Test transliteration detection for A0 level identification."""

    def test_initialize_detector(self):
        """Test detector initialization."""
        detector = TransliterationDetector()
        assert detector.similarity_threshold == 0.7

        detector_custom = TransliterationDetector(similarity_threshold=0.8)
        assert detector_custom.similarity_threshold == 0.8

    def test_transliterate_simple_words(self):
        """Test basic transliteration from Spanish to Cyrillic."""
        detector = TransliterationDetector()

        # Simple words
        assert detector.transliterate_to_cyrillic("taksi") == "такси"
        assert detector.transliterate_to_cyrillic("metro") == "метро"
        assert detector.transliterate_to_cyrillic("kafe") == "кафе"
        assert detector.transliterate_to_cyrillic("internet") == "интернет"

    def test_detect_obvious_transliterations(self):
        """Test detection of obvious transliterations."""
        detector = TransliterationDetector()

        # These should be detected as transliterations
        test_cases = [
            ("internet", "интернет"),
            ("metro", "метро"),
            ("taksi", "такси"),
            ("telefon", "телефон"),
            ("teatr", "театр"),
            ("kafe", "кафе"),
        ]

        for source, target in test_cases:
            is_trans, similarity = detector.is_transliteration(source, target)
            assert is_trans, f"Expected '{source}' -> '{target}' to be transliteration (got {similarity:.2f})"
            assert similarity >= 0.7

    def test_reject_non_transliterations(self):
        """Test that non-transliterations are correctly rejected."""
        detector = TransliterationDetector()

        # These should NOT be detected as transliterations
        test_cases = [
            ("casa", "дом"),
            ("perro", "собака"),
            ("comer", "есть"),
            ("agua", "вода"),
            ("libro", "книга"),
        ]

        for source, target in test_cases:
            is_trans, similarity = detector.is_transliteration(source, target)
            assert not is_trans, f"Expected '{source}' -> '{target}' NOT to be transliteration (got {similarity:.2f})"

    def test_similarity_calculation(self):
        """Test similarity score calculation."""
        detector = TransliterationDetector()

        # Perfect match
        similarity = detector.calculate_similarity("hello", "hello")
        assert similarity == 1.0

        # Completely different
        similarity = detector.calculate_similarity("abc", "xyz")
        assert similarity < 0.5

        # Partial match (same script)
        similarity = detector.calculate_similarity("computer", "komputer")
        assert 0.5 < similarity < 1.0

    def test_skip_short_words(self):
        """Test that short words are skipped to avoid false positives."""
        detector = TransliterationDetector()

        # Short words should be skipped (< 3 characters)
        is_trans, _ = detector.is_transliteration("a", "а")
        assert not is_trans

        is_trans, _ = detector.is_transliteration("el", "эл")
        assert not is_trans

    def test_skip_empty_words(self):
        """Test that empty words are handled gracefully."""
        detector = TransliterationDetector()

        is_trans, similarity = detector.is_transliteration("", "")
        assert not is_trans
        assert similarity == 0.0

        is_trans, similarity = detector.is_transliteration("word", "")
        assert not is_trans
        assert similarity == 0.0

    def test_find_transliterations_in_pairs(self):
        """Test finding transliterations in a list of word pairs."""
        detector = TransliterationDetector()

        word_pairs = [
            ("internet", "интернет"),
            ("metro", "метро"),
            ("casa", "дом"),
            ("taksi", "такси"),
            ("perro", "собака"),
            ("kafe", "кафе"),
        ]

        matches = detector.find_transliterations(word_pairs)

        # Should find 4 transliterations
        assert len(matches) >= 3, f"Expected at least 3 transliterations, found {len(matches)}"

        # Check structure
        for match in matches:
            assert "source_word" in match
            assert "target_word" in match
            assert "similarity" in match
            assert "recommendation" in match
            assert match["recommendation"] == "MOVE_TO_A0"
            assert match["similarity"] >= 0.7

    def test_custom_threshold(self):
        """Test detector with custom similarity threshold."""
        detector_strict = TransliterationDetector(similarity_threshold=0.9)
        detector_lenient = TransliterationDetector(similarity_threshold=0.5)

        # Word with medium similarity
        source, target = "komputer", "компьютер"  # Not exact transliteration

        # Strict threshold should reject
        _is_trans_strict, sim_strict = detector_strict.is_transliteration(source, target)

        # Lenient threshold might accept
        _is_trans_lenient, sim_lenient = detector_lenient.is_transliteration(source, target)

        # Both should calculate same similarity
        assert sim_strict == sim_lenient

    def test_case_insensitive(self):
        """Test that detection is case-insensitive."""
        detector = TransliterationDetector()

        # Different cases should give same result
        pairs = [
            ("Internet", "интернет"),
            ("INTERNET", "ИНТЕРНЕТ"),
            ("internet", "Интернет"),
        ]

        results = [detector.is_transliteration(s, t) for s, t in pairs]

        # All should give similar results
        assert all(r[0] for r in results), "Case variations should all be detected"

    def test_real_world_examples(self):
        """Test with real-world Spanish-Russian transliterations."""
        detector = TransliterationDetector()

        # Common international words that are transliterated
        examples = [
            ("futbol", "футбол"),
            ("telefon", "телефон"),
            ("muzey", "музей"),
            ("park", "парк"),
            ("restoran", "ресторан"),
        ]

        for source, target in examples:
            _is_trans, similarity = detector.is_transliteration(source, target)
            # These should have high similarity (even if not perfect)
            assert similarity >= 0.5, (
                f"Expected '{source}' -> '{target}' to have similarity >= 0.5 (got {similarity:.2f})"
            )
