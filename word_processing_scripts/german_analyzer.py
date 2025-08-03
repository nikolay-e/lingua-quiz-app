#!/usr/bin/env python3
"""
Perfect German Word Analyzer for LinguaQuiz
Combines NLP + linguistic patterns to find missing essential German vocabulary
"""

import os
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from base_analyzer import BaseWordAnalyzer
from migration_utils import (
    get_language_migration_files,
    load_spacy_model,
    normalize_word_german,
)
from wordfreq import word_frequency


class GermanWordAnalyzer(BaseWordAnalyzer):
    """
    Analyzes German vocabulary using NLP + linguistic patterns to find missing
    essential words for a learning application.
    """

    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize the German analyzer"""
        super().__init__(migrations_dir, language_code="de")
        print("🚀 Initializing German Word Analyzer...")

        # Use common model loading function
        model_preferences = ["de_core_news_lg"]
        self.nlp = load_spacy_model("de", model_preferences)

        # Initialize linguistic patterns
        self._setup_patterns()

    def _setup_patterns(self):
        """Setup German linguistic patterns for analysis"""

        # Verb ending patterns
        self.verb_endings = {
            "st": {"person": 2, "tense": "present"},
            "t": {"person": 3, "tense": "present"},
            "e": {"person": 1, "tense": "present"},
            "en": {"tense": "infinitive"},
            "et": {"person": 2, "tense": "present"},
            "te": {"tense": "past"},
            "test": {"person": 2, "tense": "past"},
            "ten": {"tense": "past", "plural": True},
            "tet": {"tense": "past"},
        }

        # Adjective ending patterns
        self.adj_endings = {
            "er": {"case": "nom", "gender": "masc", "strong": True},
            "es": {"case": "nom/acc", "gender": "neut", "strong": True},
            "e": {"case": "nom/acc", "gender": "fem", "strong": True},
            "en": {"case": "gen/dat", "strong": True},
            "em": {"case": "dat", "gender": "masc/neut", "strong": True},
        }

        # Swiss German vs Standard German mappings (only special cases that need exact mapping)
        self.swiss_standard_words = {
            # Common words that need exact mapping (patterns handle the rest)
            "heisst": "heißt",
            "weiss": "weiß",
            "ausserdem": "außerdem",
            "schliesslich": "schließlich",
        }

        # Common noun forms (plural forms, compound nouns, etc.)
        self.noun_forms = {
            "kindern": "kind",
            "bürger": "bürger",  # This is both singular and plural
            "staaten": "staat",
            "menge": "menge",  # Can be singular
            "licht": "licht",  # Singular noun
            "kreis": "kreis",  # Singular noun
            "boden": "boden",  # Singular noun
            "gemeinde": "gemeinde",  # Singular noun
            "fussball": "fußball",  # Swiss spelling
            "krieg": "krieg",  # Singular noun
            "spass": "spaß",  # Swiss spelling
            "berliner": "berlin",  # Demonym
        }

        # POS thresholds are inherited from base class (standardized)

    def normalize_word(self, word: str) -> str:
        """Normalize German word by removing articles and declension info"""
        return normalize_word_german(word)

    def get_migration_filename(self) -> str:
        """Get the migration filename for German."""
        return get_language_migration_files()["de"]

    def get_existing_words(self) -> Set[str]:
        """Extract all existing German words from the migration file"""
        german_file = os.path.join(self.migrations_dir, self.get_migration_filename())
        if not os.path.exists(german_file):
            raise FileNotFoundError(f"German migration file not found: {german_file}")

        data = self.extract_data_from_file(german_file)
        german_words = set()

        # German articles and function words to skip
        skip_words = {
            "der",
            "die",
            "das",
            "ein",
            "eine",
            "einen",
            "einem",
            "einer",
            "eines",
        }

        for _, _, _, word, _, _, _ in data:
            if word and word != "word":
                # Use common word processing method with German-specific skip words
                german_words.update(self.process_word_variants(word, skip_words))

        return german_words

    def detect_verb_form(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect if word is a verb inflection"""
        word_lower = word.lower()

        # Common modal verb forms and their infinitives
        modal_forms = {
            "muss": "müssen",
            "musst": "müssen",
            "musste": "müssen",
            "kann": "können",
            "kannst": "können",
            "konnte": "können",
            "will": "wollen",
            "willst": "wollen",
            "wollte": "wollen",
            "soll": "sollen",
            "sollst": "sollen",
            "sollte": "sollen",
            "darf": "dürfen",
            "darfst": "dürfen",
            "durfte": "dürfen",
            "mag": "mögen",
            "magst": "mögen",
            "mochte": "mögen",
        }

        # Common auxiliary verb forms
        aux_forms = {
            "bin": "sein",
            "bist": "sein",
            "ist": "sein",
            "sind": "sein",
            "seid": "sein",
            "war": "sein",
            "warst": "sein",
            "waren": "sein",
            "wart": "sein",
            "hab": "haben",
            "habe": "haben",
            "hast": "haben",
            "hat": "haben",
            "habt": "haben",
            "hatte": "haben",
            "hattest": "haben",
            "hatten": "haben",
            "hattet": "haben",
            "werde": "werden",
            "wirst": "werden",
            "wird": "werden",
            "werdet": "werden",
            "wurde": "werden",
            "wurdest": "werden",
            "wurden": "werden",
            "wurdet": "werden",
        }

        # Common irregular verb forms
        irregular_forms = {
            "liess": "lassen",
            "ließ": "lassen",
            "lässt": "lassen",
            "ging": "gehen",
            "gingst": "gehen",
            "gingen": "gehen",
            "gingt": "gehen",
            "kam": "kommen",
            "kamst": "kommen",
            "kamen": "kommen",
            "kamt": "kommen",
            "gab": "geben",
            "gabst": "geben",
            "gaben": "geben",
            "gabt": "geben",
            "sah": "sehen",
            "sahst": "sehen",
            "sahen": "sehen",
            "saht": "sehen",
            # Additional common verb forms
            "gemacht": "machen",
            "gesagt": "sagen",
            "gesehen": "sehen",
            "gewesen": "sein",
            "worden": "werden",
            "geworden": "werden",
            "gefunden": "finden",
            "gekommen": "kommen",
            "gegeben": "geben",
            "gebracht": "bringen",
            "gedacht": "denken",
            "geschrieben": "schreiben",
            "genommen": "nehmen",
            "gestellt": "stellen",
            "erreicht": "erreichen",
            "versucht": "versuchen",
            "bekommt": "bekommen",
            "spricht": "sprechen",
            "erklärt": "erklären",
            "erzählt": "erzählen",
            "funktioniert": "funktionieren",
            "beginnt": "beginnen",
            "reicht": "reichen",
            "gehört": "gehören",
            "liegt": "liegen",
            "zeigt": "zeigen",
            "bleibt": "bleiben",
            "gilt": "gelten",
            "braucht": "brauchen",
            "scheint": "scheinen",
            "fand": "finden",
            "stellt": "stellen",
            "besteht": "bestehen",
            "führt": "führen",
            "läuft": "laufen",
            "hält": "halten",
            "spielt": "spielen",
            "fällt": "fallen",
            "handelt": "handeln",
            "verloren": "verlieren",
            "hinaus": "hinausgehen",
            "kennt": "kennen",
            "setzt": "setzen",
            "sucht": "suchen",
            "hört": "hören",
            "blieb": "bleiben",
            "gefällt": "gefallen",
            "genannt": "nennen",
            "hilft": "helfen",
            "fehlt": "fehlen",
            # hätten, könnten are conditional forms
            "hätten": "haben",
            "könnten": "können",
        }

        # Check hardcoded forms first
        all_verb_forms = {**modal_forms, **aux_forms, **irregular_forms}
        if word_lower in all_verb_forms:
            infinitive = all_verb_forms[word_lower]
            if infinitive in existing_words:
                return infinitive, f"Inflected form of '{infinitive}'"

        # Then try pattern-based detection
        for ending, properties in self.verb_endings.items():
            if word_lower.endswith(ending):
                stem = word_lower[: -len(ending)]

                # Try common infinitive formations
                possible_infinitives = [stem + "en", stem + "n"]

                # Handle stem changes (ä→a, ö→o, ü→u)
                if len(stem) > 2:
                    if "ä" in stem:
                        possible_infinitives.append(stem.replace("ä", "a") + "en")
                    if "ö" in stem:
                        possible_infinitives.append(stem.replace("ö", "o") + "en")
                    if "ü" in stem:
                        possible_infinitives.append(stem.replace("ü", "u") + "en")

                # Check if any possible infinitive exists
                for inf in possible_infinitives:
                    if inf in existing_words:
                        tense_info = properties.get("tense", "conjugated")
                        person_info = (
                            f"person {properties.get('person')}"
                            if "person" in properties
                            else ""
                        )
                        return (
                            inf,
                            f"{tense_info} form of '{inf}' {person_info}".strip(),
                        )

        return None

    def detect_adjective_form(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect if word is an adjective declension"""
        word_lower = word.lower()

        # Common adjective forms with their base forms
        common_adj_forms = {
            # Forms of "groß"
            "grosser": "groß",
            "grosse": "groß",
            "grossen": "groß",
            "grosses": "groß",
            "grösser": "groß",
            "grössere": "groß",
            "grösseren": "groß",
            "grösseres": "groß",
            "grösste": "groß",
            "grössten": "groß",
            "grösstes": "groß",
            "grösstem": "groß",
            "größer": "groß",
            "größere": "groß",
            "größeren": "groß",
            "größeres": "groß",
            "größte": "groß",
            "größten": "groß",
            "größtes": "groß",
            "größtem": "groß",
            "grösste": "groß",
            "grössten": "groß",  # More Swiss German forms
            # Forms of "gut"
            "gute": "gut",
            "guten": "gut",
            "guter": "gut",
            "gutes": "gut",
            "gutem": "gut",
            "bessere": "gut",
            "besseren": "gut",
            "besserer": "gut",
            "besseres": "gut",
            "beste": "gut",
            "besten": "gut",
            "bester": "gut",
            "bestes": "gut",
            # Forms of "klein"
            "kleine": "klein",
            "kleinen": "klein",
            "kleiner": "klein",
            "kleines": "klein",
            "kleinere": "klein",
            "kleineren": "klein",
            "kleinerer": "klein",
            "kleineres": "klein",
            "kleinste": "klein",
            "kleinsten": "klein",
            "kleinster": "klein",
            "kleinstes": "klein",
            # Forms of "neu"
            "neue": "neu",
            "neuen": "neu",
            "neuer": "neu",
            "neues": "neu",
            "neuem": "neu",
            "neuere": "neu",
            "neueren": "neu",
            "neuerer": "neu",
            "neueres": "neu",
            "neueste": "neu",
            "neuesten": "neu",
            "neuester": "neu",
            "neuestes": "neu",
            # Forms of "hoch"
            "hohen": "hoch",
            "hohe": "hoch",
            "höher": "hoch",
            "höchste": "hoch",
            # Forms of "mehrere" -> "mehr" or "viel"
            "mehrere": "mehr",
            # Forms of "einzelnen" -> "einzeln"
            "einzelnen": "einzeln",
            # Forms of "europäischen" -> "europäisch"
            "europäischen": "europäisch",
        }

        # Check hardcoded forms first
        if word_lower in common_adj_forms:
            base_form = common_adj_forms[word_lower]
            if base_form in existing_words:
                return base_form, f"Inflected form of '{base_form}'"

        # Then try pattern-based detection
        for ending, properties in self.adj_endings.items():
            if word_lower.endswith(ending) and len(word_lower) > len(ending) + 2:
                stem = word_lower[: -len(ending)]

                # Possible base forms
                possible_bases = [
                    stem,
                    stem + "e",
                    stem + "er",
                    stem + "el",
                    stem + "en",
                ]

                # Check if any base form exists
                for base in possible_bases:
                    if base in existing_words:
                        declension_info = []
                        if "case" in properties:
                            declension_info.append(properties["case"])
                        if properties.get("strong"):
                            declension_info.append("strong")

                        return (
                            base,
                            f"Declined form of '{base}' ({', '.join(declension_info)})",
                        )

        return None

    def detect_colloquial_form(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect colloquial forms and contractions"""
        word_lower = word.lower()

        # Common colloquial forms and contractions
        colloquial_forms = {
            "drauf": "darauf",
            "draus": "daraus",
            "drin": "darin",
            "drunter": "darunter",
            "drüber": "darüber",
            "rein": "hinein",
            "raus": "hinaus",
            "rauf": "hinauf",
            "runter": "hinunter",
            "rüber": "hinüber",
            "rum": "herum",
            "weg": "hinweg",
            "selber": "selbst",
            "halt": "eben",  # particle meaning "just/simply"
            "heraus": "hinaus",  # variant of hinaus
            "hinaus": "hinaus",  # can be adverb or part of separable verb
            "zumindest": "mindestens",  # at least
            "sowas": "so etwas",  # something like that (colloquial)
            "siehe": "sehen",  # imperative form
            "länger": "lang",  # comparative form
        }

        if word_lower in colloquial_forms:
            standard_form = colloquial_forms[word_lower]
            if standard_form in existing_words:
                return standard_form, f"Colloquial form of '{standard_form}'"

        return None

    def detect_spelling_variant(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect Swiss German or alternative spellings using patterns"""
        word_lower = word.lower()

        # Check direct Swiss/Standard word mappings first
        if word_lower in self.swiss_standard_words:
            standard_form = self.swiss_standard_words[word_lower]
            if standard_form in existing_words:
                return standard_form, f"Swiss German spelling of '{standard_form}'"

            # For verbs like heisst→heißt, check if the infinitive form exists
            if standard_form.endswith("t"):
                infinitive_candidates = [
                    standard_form[:-1] + "en",  # heißt → heißen
                    standard_form + "en",  # might work for some cases
                ]
                for candidate in infinitive_candidates:
                    if candidate in existing_words:
                        return (
                            candidate,
                            f"Swiss German spelling of conjugated form - related to '{candidate}'",
                        )

        # Pattern-based Swiss German → Standard German replacements
        swiss_patterns = [
            ("ss", "ß"),  # Swiss ss → Standard ß
            ("ae", "ä"),  # Swiss ae → Standard ä
            ("oe", "ö"),  # Swiss oe → Standard ö
            ("ue", "ü"),  # Swiss ue → Standard ü
        ]

        for swiss_pattern, standard_pattern in swiss_patterns:
            if swiss_pattern in word_lower:
                # Try replacement
                standard_candidate = word_lower.replace(swiss_pattern, standard_pattern)
                if standard_candidate in existing_words:
                    return (
                        standard_candidate,
                        f"Swiss German spelling of '{standard_candidate}' ({swiss_pattern}→{standard_pattern})",
                    )

                # Also try the reverse (standard → Swiss) in case the word exists in Swiss form
                if standard_pattern in word_lower:
                    swiss_candidate = word_lower.replace(
                        standard_pattern, swiss_pattern
                    )
                    if swiss_candidate in existing_words:
                        return (
                            swiss_candidate,
                            f"Standard German spelling of '{swiss_candidate}'",
                        )

        return None

    def detect_plural_form(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect if word is a plural form"""
        word_lower = word.lower()

        # Skip very short words that are likely not plurals
        if len(word_lower) <= 2:
            return None

        # Check common plural endings (but be more conservative)
        plural_endings = ["er", "en", "s"]  # Removed 'e' and 'n' as too aggressive

        for ending in plural_endings:
            if word_lower.endswith(ending) and len(word_lower) > len(ending) + 2:
                possible_singular = word_lower[: -len(ending)]

                # Also check with umlaut reversal
                umlaut_reversals = [
                    possible_singular,
                    possible_singular.replace("ä", "a"),
                    possible_singular.replace("ö", "o"),
                    possible_singular.replace("ü", "u"),
                ]

                for singular in umlaut_reversals:
                    if singular in existing_words and len(singular) >= 3:
                        return singular, f"Plural of '{singular}'"

        return None

    def detect_noun_form(
        self, word: str, existing_words: Set[str]
    ) -> Optional[Tuple[str, str]]:
        """Detect if word is a noun form"""
        word_lower = word.lower()

        # Check hardcoded noun forms
        if word_lower in self.noun_forms:
            base_form = self.noun_forms[word_lower]
            if base_form in existing_words:
                return base_form, f"Form of '{base_form}'"

        return None

    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """Analyze a single word using NLP + patterns"""
        # Use spaCy for basic analysis
        doc = self.nlp(word)
        if not doc:
            return "other", "UNKNOWN", "Could not analyze"

        token = doc[0]
        lemma = token.lemma_.lower()

        # Check if lemma exists (and is different from word)
        if lemma != word.lower() and lemma in existing_words:
            return "inflected_form", token.pos_, f'Form of "{lemma}"'

        # Try pattern-based detection in order of priority

        # 1. Spelling variants FIRST
        spelling_result = self.detect_spelling_variant(word, existing_words)
        if spelling_result:
            _, reason = spelling_result
            return "morphological_variant", token.pos_, reason

        # 2. Colloquial forms and contractions
        colloquial_result = self.detect_colloquial_form(word, existing_words)
        if colloquial_result:
            _, reason = colloquial_result
            return "morphological_variant", token.pos_, reason

        # 3. Verb forms
        verb_result = self.detect_verb_form(word, existing_words)
        if verb_result:
            _, reason = verb_result
            return "inflected_form", token.pos_, reason

        # 4. Adjective forms
        adj_result = self.detect_adjective_form(word, existing_words)
        if adj_result:
            _, reason = adj_result
            return "inflected_form", token.pos_, reason

        # 5. Plural forms
        plural_result = self.detect_plural_form(word, existing_words)
        if plural_result:
            _, reason = plural_result
            return "inflected_form", token.pos_, reason

        # 6. Noun forms (including Swiss spellings, demonyms, etc.)
        noun_result = self.detect_noun_form(word, existing_words)
        if noun_result:
            _, reason = noun_result
            return "morphological_variant", token.pos_, reason

        # Check for proper nouns (cities, names, political parties, etc.)
        proper_nouns = {
            # Cities and places
            "berlin",
            "münchen",
            "hamburg",
            "wien",
            "zürich",
            "frankfurt",
            "stuttgart",
            "köln",
            "düsseldorf",
            "dortmund",
            "essen",
            "leipzig",
            "dresden",
            "hannover",
            "nürnberg",
            "duisburg",
            "bochum",
            "wuppertal",
            "bielefeld",
            "bonn",
            "mannheim",
            "karlsruhe",
            "augsburg",
            "wiesbaden",
            "mönchengladbach",
            "gelsenkirchen",
            "aachen",
            "braunschweig",
            "kiel",
            "chemnitz",
            "halle",
            "magdeburg",
            "freiburg",
            "krefeld",
            "mainz",
            "lübeck",
            # Countries and regions
            "deutschland",
            "österreich",
            "schweiz",
            "bayern",
            "sachsen",
            "thüringen",
            "baden-württemberg",
            "nordrhein-westfalen",
            "niedersachsen",
            "hessen",
            "rheinland-pfalz",
            "schleswig-holstein",
            "brandenburg",
            "mecklenburg-vorpommern",
            "saarland",
            "bremen",
            "hamburg",
            "berlin",
            "europa",
            "amerika",
            "russland",
            "frankreich",
            "england",
            "italien",
            "spanien",
            "polen",
            "tschechien",
            "ungarn",
            # Political parties
            "cdu",
            "spd",
            "afd",
            "fdp",
            "grüne",
            "linke",
            "csu",
            # Common names
            "peter",
            "michael",
            "thomas",
            "hans",
            "martin",
            "andreas",
            "wolfgang",
            "klaus",
            "jürgen",
            "günter",
            "stefan",
            "christian",
            "uwe",
            "werner",
            "frank",
            "markus",
            "maria",
            "petra",
            "sabine",
            "gabriele",
            "martina",
            "andrea",
            "barbara",
            "claudia",
            "ursula",
            "monika",
            "elisabeth",
            "eva",
            "anna",
            "brigitte",
            "heike",
            "angelika",
            # Organizations
            "nato",
            "uno",
            "eu",
            "usa",
            "udssr",
            "ddr",
            "brd",
            "bundeswehr",
            "polizei",
            # Sports teams
            "fc",
            "bvb",
            "bayern",
            "schalke",
            "werder",
            "hsv",
            "vfb",
            "eintracht",
            # Media
            "ard",
            "zdf",
            "rtl",
            "sat1",
            "pro7",
            "vox",
            "ntv",
            "n24",
            "tagesschau",
            "spiegel",
            "focus",
            "stern",
            "bild",
            "zeit",
            "welt",
            "faz",
            "sz",
        }

        if token.pos_ == "PROPN" or token.ent_type_ or word.lower() in proper_nouns:
            return (
                "proper_noun",
                token.pos_,
                f'Proper noun ({token.ent_type_ or "name"})',
            )

        # Check for English loanwords and abbreviations that shouldn't be in German learning
        english_loanwords = {
            "ok",
            "okay",
            "cool",
            "wow",
            "hey",
            "hi",
            "bye",
            "sorry",
            "baby",
            "party",
            "team",
            "job",
            "boss",
            "email",
            "computer",
            "internet",
            "facebook",
            "google",
            "twitter",
            "youtube",
            "blog",
            "chat",
            "new",
            "sex",
            "tv",
            "ii",  # Roman numerals
            # Common abbreviations
            "bzw",
            "ca",
            "etc",
            "usw",
            "ff",
            "ggf",
            "inkl",
            "evtl",
            "z.b",
            "u.a",
        }
        if word.lower() in english_loanwords:
            return (
                "foreign_word",
                token.pos_,
                "English loanword/abbreviation - not suitable for German learning",
            )

        # Check for essential categories with frequency
        freq = word_frequency(word.lower(), "de")

        if token.pos_ in ["DET", "PRON", "ADP", "PART"]:
            return "grammatical_word", token.pos_, "Grammatical word"

        if (
            token.pos_ in self.pos_thresholds
            and freq >= self.pos_thresholds[token.pos_]
        ):
            if token.pos_ in self.category_mapping:
                return (
                    self.category_mapping[token.pos_],
                    token.pos_,
                    f"High-frequency {token.pos_}",
                )

        if freq < 0.00002:
            return "low_frequency", token.pos_, f"Low frequency"

        return "other", token.pos_, f"Uncategorized {token.pos_}"

    def analyze(
        self,
        top_n: int = 1000,
        show_details: bool = True,
        limit_analysis: Optional[int] = None,
    ) -> List[Tuple[str, float, str, str]]:
        """Main analysis function"""
        if show_details:
            print("\n🔍 GERMAN WORD ANALYSIS")
            print("=" * 80)

        # Get existing words
        existing_words = self.get_existing_words()
        if show_details:
            print(f"Found {len(existing_words)} existing German words")

        # Get top N German words
        top_german = self.get_top_words(top_n)

        # Find missing words
        missing_words = []
        for word in top_german:
            normalized = word.lower()
            if normalized not in existing_words:
                missing_words.append(word)

        if show_details:
            print(f"Found {len(missing_words)} missing words from top {top_n}")
            if limit_analysis and limit_analysis < len(missing_words):
                print(f"⚠️  Limiting analysis to first {limit_analysis} words")
            print("Analyzing using NLP + linguistic patterns...")

        # Apply optional limit
        words_to_analyze = (
            missing_words[:limit_analysis] if limit_analysis else missing_words
        )

        # Analyze words
        categories = defaultdict(list)

        for word in words_to_analyze:
            category, pos_tag, reason = self.analyze_word(word, existing_words)
            freq = word_frequency(word.lower(), "de")
            categories[category].append((word, freq, reason, pos_tag))

        # Sort categories by frequency
        for category in categories:
            categories[category].sort(key=lambda x: x[1], reverse=True)

        # Generate recommendations using common function
        recommendations = []
        from migration_utils import get_essential_categories

        for category in get_essential_categories():
            if category in categories:
                for word, freq, reason, pos_tag in categories[category]:
                    recommendations.append(
                        (word, freq, category, f"{reason} [{pos_tag}]")
                    )

        recommendations.sort(key=lambda x: x[1], reverse=True)

        if show_details:
            self._display_results(dict(categories), recommendations)

        return recommendations

    def _display_results(self, categories: Dict, recommendations: List):
        """Display analysis results using standardized format."""
        from migration_utils import display_standard_results

        display_standard_results(
            categories, recommendations, "NLP + Linguistic patterns"
        )


def main():
    """Main entry point"""
    analyzer = GermanWordAnalyzer()
    analyzer.run_main(
        "Analyze German words for LinguaQuiz using NLP + linguistic patterns"
    )


if __name__ == "__main__":
    main()
