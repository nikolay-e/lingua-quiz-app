from dataclasses import dataclass
from typing import Literal

LanguageCodeType = Literal["en", "es", "de", "ru"]

try:
    import pymorphy3

    PYMORPHY_AVAILABLE = True
except ImportError:
    PYMORPHY_AVAILABLE = False


@dataclass
class MorphologicalFeatures:
    pos: str
    raw_features: dict

    def to_dict(self) -> dict:
        result = {"pos": self.pos}
        result.update(self.raw_features)
        return result

    def get_human_readable_description(self) -> str:
        parts = []

        feature_order = [
            ("Gender", {"Masc": "masculine", "Fem": "feminine", "Neut": "neuter"}),
            ("Case", {"Nom": "nominative", "Gen": "genitive", "Dat": "dative", "Acc": "accusative"}),
            ("Number", {"Sing": "singular", "Plur": "plural"}),
            ("Tense", {"Past": "past", "Pres": "present", "Fut": "future"}),
            ("Mood", {"Ind": "indicative", "Imp": "imperative"}),
            ("VerbForm", {"Inf": "infinitive", "Part": "participle", "Ger": "gerund"}),
        ]

        for feature_name, value_map in feature_order:
            if feature_name in self.raw_features:
                value = self.raw_features[feature_name]
                parts.append(value_map.get(value, value.lower()))

        parts.append(self.pos.lower())

        return " ".join(parts)


class MorphologicalAnalyzer:
    def __init__(self, language_code: LanguageCodeType):
        self.language = language_code
        self._pymorphy = None

        if language_code == "ru" and PYMORPHY_AVAILABLE:
            self._pymorphy = pymorphy3.MorphAnalyzer()
            print("Pymorphy3 loaded for Russian morphology")

    def analyze_token(self, token) -> MorphologicalFeatures:
        if self.language == "ru" and self._pymorphy:
            return self._analyze_russian(token)

        raw_features = token.morph.to_dict()

        return MorphologicalFeatures(pos=token.pos_, raw_features=raw_features)

    def _analyze_russian(self, token) -> MorphologicalFeatures:
        raw_features = token.morph.to_dict()

        if not raw_features and self._pymorphy:
            parsed = self._pymorphy.parse(token.text)
            if parsed:
                tag = parsed[0].tag

                raw_features = {
                    "Case": str(tag.case).upper() if tag.case else None,
                    "Gender": str(tag.gender).upper() if tag.gender else None,
                    "Number": str(tag.number).upper() if tag.number else None,
                    "Tense": str(tag.tense).upper() if tag.tense else None,
                    "Aspect": str(tag.aspect).upper() if tag.aspect else None,
                    "Mood": str(tag.mood).upper() if tag.mood else None,
                    "Person": str(tag.person) if tag.person else None,
                    "VerbForm": "Inf" if tag.POS == "INFN" else None,
                }

                raw_features = {k: v for k, v in raw_features.items() if v}

        return MorphologicalFeatures(pos=token.pos_, raw_features=raw_features)

    def get_paradigm_slot(self, features: MorphologicalFeatures) -> str:
        if features.pos == "NOUN":
            parts = ["NOUN"]
            if "Number" in features.raw_features:
                parts.append(features.raw_features["Number"].lower())
            if "Case" in features.raw_features:
                parts.append(features.raw_features["Case"].lower())
            return "_".join(parts)

        if features.pos == "VERB":
            parts = ["VERB"]
            if "Tense" in features.raw_features:
                parts.append(features.raw_features["Tense"].lower())
            if "Person" in features.raw_features:
                parts.append(f"{features.raw_features['Person']}p")
            if "Number" in features.raw_features:
                parts.append(features.raw_features["Number"].lower())
            return "_".join(parts)

        if features.pos == "ADJ":
            parts = ["ADJ"]
            if "Degree" in features.raw_features:
                parts.append(features.raw_features["Degree"].lower())
            return "_".join(parts)

        return features.pos

    def is_marked_form(self, features: MorphologicalFeatures) -> bool:
        if features.pos == "NOUN":
            return features.raw_features.get("Number") == "Plur" or features.raw_features.get("Case") not in [
                None,
                "Nom",
            ]

        if features.pos == "VERB":
            return features.raw_features.get("Tense") not in [None, "Pres"] or features.raw_features.get(
                "VerbForm"
            ) not in [None, "Fin", "Inf"]

        if features.pos == "ADJ":
            return features.raw_features.get("Degree") not in [None, "Pos"]

        return False
