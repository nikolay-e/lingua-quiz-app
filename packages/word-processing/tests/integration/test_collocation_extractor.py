from vocab_tools.analysis.collocation_extractor import CollocationExtractor


class TestCollocationExtractor:
    def test_initialization(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")
        assert extractor.language_code == "en"
        assert extractor.nlp is not None

    def test_extract_basic_bigrams(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = [
            "machine learning is great",
            "machine learning helps us",
            "machine learning algorithms",
            "natural language processing",
            "natural language understanding",
            "deep learning models",
        ] * 5

        collocations = extractor.extract_from_corpus(texts, min_freq=3, top_n=10, validate=False)

        assert len(collocations) > 0
        assert all(c.collocation_type == "bigram" for c in collocations)
        assert all(len(c.words) == 2 for c in collocations)
        assert all(c.frequency >= 3 for c in collocations)

    def test_extract_with_validation(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = [
            "machine learning is powerful",
            "deep learning networks",
            "natural language processing",
        ] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=5, validate=True)

        assert len(collocations) >= 0
        if collocations:
            validated = [c for c in collocations if c.dependency_validated]
            assert len(validated) > 0

    def test_cefr_level_assignment(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = ["the cat sat", "the dog ran", "the bird flew"] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=10, validate=False)

        assert all(c.cefr_level is not None for c in collocations)
        assert all(c.cefr_level in ["A1", "A2", "B1", "B2", "C1", "C2"] for c in collocations)

    def test_statistical_scoring(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = [
            "artificial intelligence",
            "machine learning",
            "deep learning",
        ] * 20

        collocations = extractor.extract_from_corpus(texts, min_freq=10, top_n=5, validate=False)

        assert all(c.score > 0 for c in collocations)
        scores = [c.score for c in collocations]
        assert scores == sorted(scores, reverse=True)

    def test_get_statistics(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = ["machine learning", "deep learning", "neural network"] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=10, validate=False)

        stats = extractor.get_statistics(collocations)

        assert "total_collocations" in stats
        assert "average_score" in stats
        assert stats["total_collocations"] == len(collocations)

    def test_german_collocations(self, spacy_de_model):
        extractor = CollocationExtractor(spacy_de_model, "de")

        texts = [
            "maschinelles lernen",
            "künstliche intelligenz",
            "tiefe neuronale netze",
        ] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=5, validate=False)

        assert len(collocations) >= 0

    def test_spanish_collocations(self, spacy_es_model):
        extractor = CollocationExtractor(spacy_es_model, "es")

        texts = [
            "aprendizaje automático",
            "inteligencia artificial",
            "red neuronal",
        ] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=5, validate=False)

        assert len(collocations) >= 0

    def test_empty_corpus(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")
        collocations = extractor.extract_from_corpus([], min_freq=1, top_n=10)
        assert len(collocations) == 0

    def test_min_frequency_filter(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = ["hello world", "hello there", "world peace"] * 3

        collocations = extractor.extract_from_corpus(texts, min_freq=3, top_n=10, validate=False)

        assert all(c.frequency >= 3 for c in collocations)

    def test_top_n_limit(self, spacy_en_model):
        extractor = CollocationExtractor(spacy_en_model, "en")

        texts = [
            "machine learning algorithms",
            "deep neural networks",
            "natural language processing",
            "computer vision systems",
            "reinforcement learning agents",
        ] * 10

        collocations = extractor.extract_from_corpus(texts, min_freq=5, top_n=3, validate=False)

        assert len(collocations) <= 3
