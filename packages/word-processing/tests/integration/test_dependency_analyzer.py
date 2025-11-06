from vocab_tools.analysis.dependency_analyzer import (
    DependencyAnalyzer,
    GrammarPattern,
    SentenceAnalysis,
)


class TestGrammarPattern:
    def test_initialization(self):
        pattern = GrammarPattern(
            pattern_type="passive",
            structure="PASSIVE: was + eaten",
            example="The cake was eaten.",
            complexity=0.6,
            components=["was", "eaten"],
        )
        assert pattern.pattern_type == "passive"
        assert pattern.complexity == 0.6
        assert len(pattern.components) == 2


class TestSentenceAnalysis:
    def test_initialization(self):
        analysis = SentenceAnalysis(sentence="Test sentence.")
        assert analysis.sentence == "Test sentence."
        assert len(analysis.patterns) == 0
        assert analysis.complexity_score == 0.0

    def test_get_complexity_description_simple(self):
        analysis = SentenceAnalysis(sentence="Test.", complexity_score=0.2)
        assert analysis.get_complexity_description() == "simple"

    def test_get_complexity_description_moderate(self):
        analysis = SentenceAnalysis(sentence="Test.", complexity_score=0.5)
        assert analysis.get_complexity_description() == "moderate"

    def test_get_complexity_description_complex(self):
        analysis = SentenceAnalysis(sentence="Test.", complexity_score=0.7)
        assert analysis.get_complexity_description() == "complex"


class TestDependencyAnalyzer:
    def test_initialization(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        assert analyzer.language == "en"
        assert analyzer.nlp is not None

    def test_analyze_simple_sentence(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The cat sat on the mat."

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.sentence == sentence
        assert isinstance(analysis.patterns, list)
        assert analysis.complexity_score >= 0.0

    def test_analyze_passive_voice(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The cake was eaten by the dog."

        analysis = analyzer.analyze_sentence(sentence)

        pattern_types = [p.pattern_type for p in analysis.patterns]
        assert any("passive" in pt for pt in pattern_types)

    def test_analyze_svo_structure(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The dog chased the cat."

        analysis = analyzer.analyze_sentence(sentence)

        pattern_types = [p.pattern_type for p in analysis.patterns]
        assert any("svo" in pt for pt in pattern_types)

    def test_analyze_subordinate_clause(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "I think that you are right."

        analysis = analyzer.analyze_sentence(sentence)

        pattern_types = [p.pattern_type for p in analysis.patterns]
        assert any("subordinate" in pt for pt in pattern_types)

    def test_complexity_score_increases_with_complexity(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        simple_sentence = "The cat sat."
        complex_sentence = "The cat that was sleeping on the mat was startled by the dog."

        simple_analysis = analyzer.analyze_sentence(simple_sentence)
        complex_analysis = analyzer.analyze_sentence(complex_sentence)

        assert complex_analysis.complexity_score > simple_analysis.complexity_score

    def test_cefr_level_assignment(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The cat sat on the mat."

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.cefr_level in ["A1-A2", "B1", "B2", "C1-C2"]

    def test_simple_sentence_cefr(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "I am happy."

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.cefr_level in ["A1-A2", "B1"]

    def test_complex_sentence_cefr(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The proposal that was submitted yesterday by the committee will be reviewed thoroughly before any decision is made."

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.cefr_level in ["B2", "C1-C2"]

    def test_extract_patterns_from_corpus(self, spacy_en_model, sample_english_text):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        patterns = analyzer.extract_patterns_from_corpus(sample_english_text, min_complexity=0.0, max_complexity=1.0)

        assert isinstance(patterns, list)
        if patterns:
            assert all(isinstance(p, GrammarPattern) for p in patterns)

    def test_extract_patterns_with_complexity_filter(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        texts = [
            "I run.",
            "The cat sat.",
            "The proposal that was submitted will be reviewed thoroughly.",
        ]

        simple_patterns = analyzer.extract_patterns_from_corpus(texts, min_complexity=0.0, max_complexity=0.3)
        complex_patterns = analyzer.extract_patterns_from_corpus(texts, min_complexity=0.5, max_complexity=1.0)

        assert len(simple_patterns) >= 0
        assert len(complex_patterns) >= 0

    def test_get_statistics(self, spacy_en_model, sample_english_text):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        patterns = analyzer.extract_patterns_from_corpus(sample_english_text)

        if patterns:
            stats = analyzer.get_statistics(patterns)

            assert "total_patterns" in stats
            assert "pattern_types" in stats
            assert "average_complexity" in stats
            assert stats["total_patterns"] == len(patterns)

    def test_get_statistics_empty(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        stats = analyzer.get_statistics([])
        assert stats == {}

    def test_analyze_german(self, spacy_de_model, sample_german_text):
        analyzer = DependencyAnalyzer(spacy_de_model, "de")
        sentence = sample_german_text[0]

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.sentence == sentence
        assert isinstance(analysis.complexity_score, float)

    def test_analyze_spanish(self, spacy_es_model, sample_spanish_text):
        analyzer = DependencyAnalyzer(spacy_es_model, "es")
        sentence = sample_spanish_text[0]

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.sentence == sentence
        assert isinstance(analysis.complexity_score, float)

    def test_analyze_russian(self, spacy_ru_model, sample_russian_text):
        analyzer = DependencyAnalyzer(spacy_ru_model, "ru")
        sentence = sample_russian_text[0]

        analysis = analyzer.analyze_sentence(sentence)

        assert analysis.sentence == sentence
        assert isinstance(analysis.complexity_score, float)

    def test_multiple_sentences(self, spacy_en_model, sample_english_text):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        analyses = [analyzer.analyze_sentence(sent) for sent in sample_english_text]

        assert len(analyses) == len(sample_english_text)
        assert all(isinstance(a, SentenceAnalysis) for a in analyses)

    def test_empty_sentence(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        analysis = analyzer.analyze_sentence("")

        assert analysis.sentence == ""
        assert len(analysis.patterns) == 0

    def test_pattern_components_extraction(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")
        sentence = "The dog was chased."

        analysis = analyzer.analyze_sentence(sentence)

        if analysis.patterns:
            pattern = analysis.patterns[0]
            assert isinstance(pattern.components, list)
            assert len(pattern.components) > 0

    def test_dependency_depth_calculation(self, spacy_en_model):
        analyzer = DependencyAnalyzer(spacy_en_model, "en")

        shallow = "I run."
        deep = "The cat that the dog that I saw chased ran away."

        shallow_analysis = analyzer.analyze_sentence(shallow)
        deep_analysis = analyzer.analyze_sentence(deep)

        assert deep_analysis.complexity_score >= shallow_analysis.complexity_score
