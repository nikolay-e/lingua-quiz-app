from vocab_tools.analysis.morphological_analyzer import (
    MorphologicalAnalyzer,
    MorphologicalFeatures,
)


class TestMorphologicalFeatures:
    def test_initialization(self):
        features = MorphologicalFeatures(pos="NOUN", raw_features={"Case": "Nom", "Number": "Sing"})
        assert features.pos == "NOUN"
        assert features.raw_features["Case"] == "Nom"

    def test_to_dict(self):
        features = MorphologicalFeatures(pos="VERB", raw_features={"Tense": "Past", "Person": "3"})
        result = features.to_dict()

        assert result["pos"] == "VERB"
        assert result["Tense"] == "Past"
        assert result["Person"] == "3"

    def test_get_human_readable_description_noun(self):
        features = MorphologicalFeatures(
            pos="NOUN",
            raw_features={"Case": "Nom", "Number": "Sing", "Gender": "Masc"},
        )
        description = features.get_human_readable_description()

        assert "masculine" in description
        assert "nominative" in description
        assert "singular" in description
        assert "noun" in description

    def test_get_human_readable_description_verb(self):
        features = MorphologicalFeatures(pos="VERB", raw_features={"Tense": "Past", "Mood": "Ind"})
        description = features.get_human_readable_description()

        assert "past" in description
        assert "indicative" in description
        assert "verb" in description


class TestMorphologicalAnalyzer:
    def test_initialization_english(self):
        analyzer = MorphologicalAnalyzer("en")
        assert analyzer.language == "en"

    def test_initialization_russian(self):
        analyzer = MorphologicalAnalyzer("ru")
        assert analyzer.language == "ru"

    def test_analyze_token_english(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("cats")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos == "NOUN"
        assert isinstance(features.raw_features, dict)

    def test_analyze_token_verb(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("running")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos in ["VERB", "NOUN"]

    def test_get_paradigm_slot_noun(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("cats")
        token = doc[0]

        features = analyzer.analyze_token(token)
        slot = analyzer.get_paradigm_slot(features)

        assert slot.startswith("NOUN")

    def test_get_paradigm_slot_verb(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("ran")
        token = doc[0]

        features = analyzer.analyze_token(token)
        slot = analyzer.get_paradigm_slot(features)

        assert slot.startswith("VERB")

    def test_get_paradigm_slot_adjective(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("better")
        token = doc[0]

        features = analyzer.analyze_token(token)
        slot = analyzer.get_paradigm_slot(features)

        assert slot.startswith(("ADJ", "ADV"))

    def test_is_marked_form_noun_singular(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("cat")
        token = doc[0]

        features = analyzer.analyze_token(token)
        is_marked = analyzer.is_marked_form(features)

        assert not is_marked

    def test_is_marked_form_noun_plural(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("cats")
        token = doc[0]

        features = analyzer.analyze_token(token)
        is_marked = analyzer.is_marked_form(features)

        assert is_marked

    def test_is_marked_form_verb_base(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("run")
        token = doc[0]

        features = analyzer.analyze_token(token)
        is_marked = analyzer.is_marked_form(features)

        assert isinstance(is_marked, bool)

    def test_analyze_german(self, spacy_de_model):
        analyzer = MorphologicalAnalyzer("de")
        doc = spacy_de_model("Katzen")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos == "NOUN"
        assert isinstance(features.raw_features, dict)

    def test_analyze_spanish(self, spacy_es_model):
        analyzer = MorphologicalAnalyzer("es")
        doc = spacy_es_model("gatos")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos == "NOUN"

    def test_analyze_russian_with_pymorphy(self, spacy_ru_model):
        analyzer = MorphologicalAnalyzer("ru")
        doc = spacy_ru_model("кошки")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos == "NOUN"
        assert isinstance(features.raw_features, dict)

    def test_russian_case_detection(self, spacy_ru_model):
        analyzer = MorphologicalAnalyzer("ru")

        doc = spacy_ru_model("кошка")
        token = doc[0]
        features = analyzer.analyze_token(token)

        slot = analyzer.get_paradigm_slot(features)
        assert "NOUN" in slot

    def test_multiple_tokens(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("The cats are running quickly")

        features_list = [analyzer.analyze_token(token) for token in doc]

        assert len(features_list) == 5
        assert all(isinstance(f, MorphologicalFeatures) for f in features_list)

    def test_pos_tags_variety(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("The quick brown fox jumps")

        pos_tags = [analyzer.analyze_token(token).pos for token in doc]

        assert "DET" in pos_tags or "ART" in pos_tags
        assert "ADJ" in pos_tags
        assert "NOUN" in pos_tags
        assert "VERB" in pos_tags

    def test_empty_raw_features(self, spacy_en_model):
        analyzer = MorphologicalAnalyzer("en")
        doc = spacy_en_model("the")
        token = doc[0]

        features = analyzer.analyze_token(token)

        assert features.pos is not None
        assert isinstance(features.raw_features, dict)
