from typing import ClassVar


class InflectionReasonGenerator:
    BASE_PATTERNS: ClassVar[dict[str, str]] = {
        "Tense=Past": "Past tense of '{lemma}'",
        "Number=Plur": "Plural form of '{lemma}'",
        "Degree=Cmp": "Comparative form of '{lemma}'",
        "Degree=Sup": "Superlative form of '{lemma}'",
        "VerbForm=Ger": "Gerund form of '{lemma}'",
        "VerbForm=Part": "Participle form of '{lemma}'",
    }

    def get_reason(self, morphology: str, lemma: str, pos_tag: str = None) -> str:
        for pattern, template in self.BASE_PATTERNS.items():
            if pattern in morphology:
                return template.format(lemma=lemma)

        return f"Inflected form of '{lemma}'"


class EnglishInflectionGenerator(InflectionReasonGenerator):
    pass


class GermanInflectionGenerator(InflectionReasonGenerator):
    def get_reason(self, morphology: str, lemma: str, pos_tag: str = None) -> str:
        base_reason = super().get_reason(morphology, lemma, pos_tag)

        if base_reason != f"Inflected form of '{lemma}'":
            return base_reason

        if pos_tag == "VERB":
            if "Person=1" in morphology and "Number=Sing" in morphology:
                return f"First person singular of '{lemma}'"
            if "Person=2" in morphology:
                return f"Second person form of '{lemma}'"
            if "Person=3" in morphology:
                return f"Third person form of '{lemma}'"
            return f"Conjugated form of '{lemma}'"

        if pos_tag == "NOUN":
            if "Case=Dat" in morphology:
                return f"Dative form of '{lemma}'"
            if "Case=Gen" in morphology:
                return f"Genitive form of '{lemma}'"
            if "Case=Acc" in morphology:
                return f"Accusative form of '{lemma}'"
            return f"Inflected form of '{lemma}'"

        if pos_tag == "ADJ":
            return f"Inflected adjective form of '{lemma}'"

        return f"Inflected form of '{lemma}'"


class SpanishInflectionGenerator(InflectionReasonGenerator):
    def get_reason(self, morphology: str, lemma: str, pos_tag: str = None) -> str:
        base_reason = super().get_reason(morphology, lemma, pos_tag)

        if base_reason != f"Inflected form of '{lemma}'":
            return base_reason

        if pos_tag == "VERB":
            if "Tense=Pres" in morphology and "Person=1" in morphology:
                return f"First person present of '{lemma}'"
            if "Tense=Pres" in morphology and "Person=2" in morphology:
                return f"Second person present of '{lemma}'"
            if "Tense=Pres" in morphology and "Person=3" in morphology:
                return f"Third person present of '{lemma}'"
            if "Tense=Imp" in morphology:
                return f"Imperfect tense of '{lemma}'"
            if "Tense=Fut" in morphology:
                return f"Future tense of '{lemma}'"
            if "Mood=Sub" in morphology:
                return f"Subjunctive form of '{lemma}'"
            return f"Conjugated form of '{lemma}'"

        if pos_tag == "NOUN":
            if "Gender=Masc" in morphology:
                return f"Masculine form of '{lemma}'"
            if "Gender=Fem" in morphology:
                return f"Feminine form of '{lemma}'"
            return f"Inflected form of '{lemma}'"

        if pos_tag == "ADJ":
            if "Number=Plur" in morphology and "Gender=Masc" in morphology:
                return f"Masculine plural form of '{lemma}'"
            if "Number=Plur" in morphology and "Gender=Fem" in morphology:
                return f"Feminine plural form of '{lemma}'"
            if "Gender=Fem" in morphology:
                return f"Feminine form of '{lemma}'"
            return f"Inflected adjective form of '{lemma}'"

        return f"Inflected form of '{lemma}'"


def get_inflection_generator(language_code: str) -> InflectionReasonGenerator:
    generators = {
        "en": EnglishInflectionGenerator,
        "de": GermanInflectionGenerator,
        "es": SpanishInflectionGenerator,
    }

    generator_class = generators.get(language_code, InflectionReasonGenerator)
    return generator_class()
