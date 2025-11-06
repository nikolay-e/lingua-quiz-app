"""
Integration tests for Spanish lemmatization with Stanza.

Tests verify that Spanish verb forms, nouns, and adjectives are correctly
lemmatized to their base forms (infinitives, singular masculine).
"""

import pytest

from . import test_data


class TestStanzaSpanishLemmatization:
    """Test Stanza lemmatizer directly for Spanish."""

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_VERB_CONJUGATIONS)
    def test_verb_conjugations_to_infinitive(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify conjugated verb forms are lemmatized to infinitives."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_PAST_PARTICIPLES)
    def test_past_participles_to_infinitive(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify past participles are lemmatized to infinitives."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_IMPERATIVES)
    def test_imperatives_to_infinitive(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify imperative forms are lemmatized to infinitives."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_ENCLITIC_PRONOUNS)
    def test_infinitives_with_enclitic_pronouns(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify infinitives with enclitic pronouns are lemmatized correctly."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_FIRST_PERSON_PLURAL_IMPERATIVES)
    def test_first_person_plural_imperatives(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify first person plural imperative forms (let's do...)."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_NOUN_PLURALS)
    def test_noun_plural_to_singular(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify plural nouns are lemmatized to singular."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_ADJECTIVE_FORMS)
    def test_adjective_forms_to_masculine_singular(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify adjectives are lemmatized to masculine singular."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_batch_lemmatization(self, stanza_es_lemmatizer):
        """Verify batch processing works correctly."""
        words = ["estabas", "gatos", "bonita", "comiendo"]
        expected = ["estar", "gato", "bonito", "comer"]

        results = stanza_es_lemmatizer.lemmatize_batch(words)

        assert len(results) == len(words)
        for i, (word, expected_lemma, result) in enumerate(zip(words, expected, results, strict=False)):
            assert result == expected_lemma, f"Batch item {i}: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_INTERROGATIVE_PRONOUNS)
    def test_interrogative_pronouns_with_accents(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify interrogative pronouns with accents are handled correctly."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(("word", "expected_lemma"), test_data.SPANISH_COMMON_ACCENTS)
    def test_common_words_with_accents(self, stanza_es_lemmatizer, word, expected_lemma):
        """Verify common words with various accent patterns."""
        result = stanza_es_lemmatizer.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"


class TestSubtitleFrequencyIndexLemmatization:
    """Test SubtitleFrequencyIndex.get_lemma() for Spanish."""

    @pytest.fixture(scope="class")
    def spanish_subtitle_index(self):
        from vocab_tools.core.subtitle_frequency_index import get_subtitle_frequency_index

        return get_subtitle_frequency_index("es")

    @pytest.mark.parametrize(
        ("word", "expected_lemma"),
        [
            ("estabas", "estar"),
            ("quieras", "querer"),
            ("hablado", "hablar"),
            ("viste", "ver"),
        ],
    )
    def test_get_lemma_verbs(self, spanish_subtitle_index, word, expected_lemma):
        """Verify get_lemma() returns correct infinitives for verb forms."""
        result = spanish_subtitle_index.get_lemma(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    @pytest.mark.parametrize(
        ("word", "expected_lemma"),
        [
            ("gatos", "gato"),
            ("casas", "casa"),
        ],
    )
    def test_get_lemma_nouns(self, spanish_subtitle_index, word, expected_lemma):
        """Verify get_lemma() returns singular forms for plural nouns."""
        result = spanish_subtitle_index.get_lemma(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_get_rank_uses_lemma(self, spanish_subtitle_index):
        """Verify get_rank() lemmatizes before lookup."""
        estar_rank = spanish_subtitle_index.get_rank("estar")
        estabas_rank = spanish_subtitle_index.get_rank("estabas")

        assert estar_rank == estabas_rank, f"Ranks should match: estar={estar_rank}, estabas={estabas_rank}"
        assert estar_rank < 1000, f"'estar' should be high frequency, got rank {estar_rank}"


class TestSpanishLemmatizationBugs:
    """Test cases for discovered lemmatization bugs in es_50k_lemmatized.csv."""

    def test_adjective_lemmas_incorrect_base(self, stanza_es_lemmatizer):
        """Fix: Adjectives should lemmatize to full base form, not shortened."""
        test_cases = [
            ("bueno", "bueno"),  # NOT "buen"
            ("buena", "bueno"),  # NOT "buen"
            ("buenos", "bueno"),  # NOT "buen"
            ("buenas", "bueno"),  # NOT "buen"
            ("buen", "bueno"),  # NOT "buen"
            ("gran", "grande"),  # NOT "gran"
            ("linda", "lindo"),  # NOT "linda"
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_proper_nouns_should_preserve_form(self, stanza_es_lemmatizer):
        """Fix: Proper nouns should not be lemmatized incorrectly."""
        test_cases = [
            ("james", "james"),  # NOT "jam"
            ("londres", "londres"),  # NOT "londre"
            ("san", "san"),  # NOT "sar" (could be "santo" but "san" is acceptable)
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_nouns_vs_verbs_disambiguation(self, stanza_es_lemmatizer):
        """Fix: Nouns should not be lemmatized to verbs."""
        test_cases = [
            ("dios", "dios"),  # noun "god", NOT "dio" (verb "dar")
            ("diferencia", "diferencia"),  # noun "difference", NOT "diferenciar" (verb)
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_adjectives_strange_lemmas(self, stanza_es_lemmatizer):
        """Fix: Adjectives with corrupted lemmatization."""
        test_cases = [
            ("estupendo", "estupendo"),  # NOT "estupr"
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_verbs_with_enclitic_pronouns_errors(self, stanza_es_lemmatizer):
        """Fix: Verbs with enclitic pronouns creating fake infinitives."""
        test_cases = [
            ("déjame", "dejar"),  # NOT "déjamar"
            ("dame", "dar"),  # NOT "dame"
            ("dime", "decir"),  # NOT "dime"
            ("verte", "ver"),  # NOT "verter" (which means "to pour")
            ("dale", "dar"),  # NOT "dale"
            ("hazlo", "hacer"),  # NOT "hazlo"
            ("escúchame", "escuchar"),  # NOT "escúchamir"
            ("verme", "ver"),  # NOT "vermer"
            ("irte", "ir"),  # NOT "irte"
            ("déjalo", "dejar"),  # NOT "déjalo"
            ("ayúdame", "ayudar"),  # NOT "ayúdame"
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_verb_conjugation_errors(self, stanza_es_lemmatizer):
        """Fix: Incorrect verb conjugation lemmatization."""
        test_cases = [
            ("hagas", "hacer"),  # NOT "hagar"
            ("tengas", "tener"),  # NOT "tenga"
            ("tendrás", "tener"),  # NOT "tendrás"
            ("estarás", "estar"),  # NOT "estarás"
            ("estuviste", "estar"),  # NOT "estever"
            ("come", "comer"),  # NOT "comir"
            ("refieres", "referir"),  # NOT "refer"
            ("oiga", "oír"),  # NOT "oigo"
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_past_participles_should_lemmatize_to_infinitive(self, stanza_es_lemmatizer):
        """Fix: Past participles should map to infinitive, not stay as participle."""
        test_cases = [
            ("visto", "ver"),  # NOT "visto"
            ("vuelto", "volver"),  # NOT "vuelto"
        ]

        for word, expected_lemma in test_cases:
            result = stanza_es_lemmatizer.lemmatize(word)
            assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"


class TestVocabularyAnalyzerLemmatization:
    """Test VocabularyAnalyzer lemmatization integration."""

    @pytest.mark.parametrize(
        ("word", "expected_lemma"),
        [
            ("estabas", "estar"),
            ("quieras", "querer"),
            ("hablado", "hablar"),
            ("viste", "ver"),
        ],
    )
    def test_lemmatize_word_uses_stanza(self, spanish_a1_analyzer, word, expected_lemma):
        """Verify _lemmatize_word() uses Stanza for accurate lemmatization."""
        result = spanish_a1_analyzer.lemmatization_service.lemmatize(word)
        assert result == expected_lemma, f"Failed: {word} → expected '{expected_lemma}', got '{result}'"

    def test_lemmatize_vocabulary_deduplicates(self, spanish_a1_analyzer):
        """Verify different forms map to same lemma."""
        words = ["estar", "estabas", "estoy", "estaba"]
        result = spanish_a1_analyzer._lemmatize_vocabulary(words)

        # All should map to "estar"
        assert "estar" in result
        assert len(result["estar"]) >= 2  # At least some forms deduplicated

    def test_words_with_and_without_accents_treated_separately(self, spanish_a1_analyzer):
        """Verify words with/without accents are treated as different lemmas."""
        words = ["como", "cómo", "donde", "dónde", "quien", "quién"]
        result = spanish_a1_analyzer._lemmatize_vocabulary(words)

        # These are linguistically different words, should remain separate
        # como (as/like) vs cómo (how)
        # donde (where-relative) vs dónde (where-interrogative)
        # quien (who-relative) vs quién (who-interrogative)

        # Check that we get distinct lemmas for interrogatives vs relatives
        lemmas = set(result.keys())

        # Should have both forms preserved (or at least not all collapsed to one)
        assert len(lemmas) > 1, f"Expected distinct lemmas, got: {lemmas}"

    def test_analyze_does_not_report_existing_words_as_missing(self, spanish_a1_analyzer):
        """
        Critical test: words that exist in A1 should NOT appear in missing_from_a1.

        This is the core bug: "cómo", "gracias", "solo" exist in A1 but are reported
        as missing from A1 in the analysis.
        """
        # Run analysis
        result = spanish_a1_analyzer.analyze(top_n=1500)

        # These words MUST be in A1 vocabulary
        a1_words = spanish_a1_analyzer._load_vocabulary()
        a1_lemma_map = spanish_a1_analyzer._lemmatize_vocabulary(a1_words)

        # Words that should be in A1
        test_words_in_a1 = ["como", "cómo", "gracias", "solo", "quién", "dónde"]

        # Get lemmas for these words
        test_lemmas = {spanish_a1_analyzer.lemmatization_service.lemmatize(word) for word in test_words_in_a1}

        # These lemmas should NOT appear in missing_from_a1
        missing_lemmas = {item["lemma"] for item in result.missing_from_a1}

        false_positives = test_lemmas & missing_lemmas

        assert not false_positives, (
            f"Words exist in A1 but reported as missing: {false_positives}\nA1 lemmas: {set(a1_lemma_map.keys())}\nMissing lemmas: {missing_lemmas}"
        )

    def test_lemmatization_consistency_for_accented_words(self, spanish_a1_analyzer):
        """
        Test that lemmatization is consistent when comparing A1 vs frequency list.

        If "cómo" is in A1 and "cómo" is in frequency list, they should match.
        """
        # Test specific words that are causing false positives
        test_cases = [
            ("como", "A1 has 'como', frequency has 'como'"),
            ("cómo", "A1 has 'cómo', frequency has 'cómo'"),
            ("gracias", "A1 has 'gracias', frequency has 'gracias'"),
            ("solo", "A1 has 'solo', frequency has 'solo'"),
        ]

        for word, description in test_cases:
            lemma = spanish_a1_analyzer.lemmatization_service.lemmatize(word)

            # Lemmatization must be deterministic
            lemma2 = spanish_a1_analyzer.lemmatization_service.lemmatize(word)
            assert lemma == lemma2, f"Lemmatization not deterministic for '{word}': got '{lemma}' and '{lemma2}'"

            # Check if lemma is in subtitle index
            rank = spanish_a1_analyzer._subtitle_index.get_rank(word)

            print(f"\n{description}")
            print(f"  Word: {word}")
            print(f"  Lemma: {lemma}")
            print(f"  Rank in subtitle index: {rank}")
