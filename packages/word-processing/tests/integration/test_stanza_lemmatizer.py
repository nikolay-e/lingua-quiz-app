import pytest

from vocab_tools.core.stanza_lemmatizer import StanzaLemmatizer, get_stanza_lemmatizer


class TestStanzaLemmatizer:
    def test_initialization_english(self):
        lemmatizer = StanzaLemmatizer("en")
        assert lemmatizer.language == "en"

    def test_initialization_unsupported_language(self):
        lemmatizer = StanzaLemmatizer("fr")
        assert lemmatizer.language == "fr"
        assert not lemmatizer.is_available()

    def test_lemmatize_single_word_english(self):
        lemmatizer = get_stanza_lemmatizer("en")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for English")

        result = lemmatizer.lemmatize("running")
        assert result in {"run", "running"}

        result = lemmatizer.lemmatize("cats")
        assert result == "cat"

    def test_lemmatize_batch_english(self, sample_words_english):
        lemmatizer = get_stanza_lemmatizer("en")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for English")

        words = ["running", "cats", "better", "went"]
        lemmas = lemmatizer.lemmatize_batch(words)

        assert len(lemmas) == len(words)
        assert isinstance(lemmas, list)
        assert all(isinstance(lemma, str) for lemma in lemmas)

    def test_lemmatize_german(self):
        lemmatizer = get_stanza_lemmatizer("de")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for German")

        result = lemmatizer.lemmatize("Katzen")
        assert result == "katze"

        result = lemmatizer.lemmatize("läuft")
        assert result == "laufen"

    def test_lemmatize_spanish(self):
        lemmatizer = get_stanza_lemmatizer("es")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for Spanish")

        result = lemmatizer.lemmatize("gatos")
        assert isinstance(result, str)
        assert len(result) > 0

        result = lemmatizer.lemmatize("corriendo")
        assert isinstance(result, str)
        assert len(result) > 0

    def test_lemmatize_russian(self):
        lemmatizer = get_stanza_lemmatizer("ru")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for Russian")

        result = lemmatizer.lemmatize("кошки")
        assert result == "кошка"

        result = lemmatizer.lemmatize("бежал")
        assert result == "бежать"

    def test_batch_performance(self):
        lemmatizer = get_stanza_lemmatizer("en")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for English")

        words = ["running", "cats", "better"] * 100
        lemmas = lemmatizer.lemmatize_batch(words)

        assert len(lemmas) == len(words)

    def test_empty_word(self):
        lemmatizer = get_stanza_lemmatizer("en")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available for English")

        result = lemmatizer.lemmatize("")
        assert result == ""

    def test_cache_behavior(self):
        lemmatizer = get_stanza_lemmatizer("en")
        if not lemmatizer.is_available():
            pytest.skip("Stanza not available")

        result1 = lemmatizer.lemmatize("running")
        result2 = lemmatizer.lemmatize("running")

        assert result1 == result2


class TestIntegrationWithLemmatizer:
    def test_lemmatizer_uses_stanza_when_enabled(self):
        from vocab_tools.core.lemmatizer import Lemmatizer

        lemmatizer = Lemmatizer(use_stanza=True)
        result = lemmatizer.get_lemma("running", "en")

        assert isinstance(result, str)
        assert len(result) > 0

    def test_lemmatizer_fallback_to_spacy(self, spacy_en_model):
        from vocab_tools.core.lemmatizer import Lemmatizer

        lemmatizer = Lemmatizer(use_stanza=False)
        result = lemmatizer.get_lemma("running", "en")

        assert isinstance(result, str)
        assert result in ["run", "running"]

    def test_batch_lemmatization_with_stanza(self, sample_words_english):
        from vocab_tools.core.lemmatizer import Lemmatizer

        lemmatizer = Lemmatizer(use_stanza=True)
        result = lemmatizer.lemmatize_word_list(sample_words_english, "en")

        assert isinstance(result, list)
        assert len(result) > 0
        assert len(result) <= len(sample_words_english)
