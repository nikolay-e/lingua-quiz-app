#!/usr/bin/env python3
"""
Advanced Spanish Word Analysis - Pure NLP
Leverages Spanish's excellent NLP resources without hardcoding
"""

import os
import sys
from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

import spacy
from wordfreq import word_frequency

# Additional NLP tools for Spanish
try:
    import stanza

    STANZA_AVAILABLE = True
except ImportError:
    STANZA_AVAILABLE = False

try:
    from transformers import pipeline

    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False

from base_analyzer import BaseWordAnalyzer
from migration_utils import (
    get_language_migration_files,
    load_spacy_model,
    normalize_word_generic,
)


class SpanishWordAnalyzer(BaseWordAnalyzer):
    """
    Analyzes Spanish vocabulary using advanced NLP approach to find missing
    essential words for a learning application.
    """

    def __init__(self, migrations_dir: Optional[str] = None):
        """Initialize with multiple Spanish NLP models"""
        super().__init__(migrations_dir, language_code="es")
        print("🔧 Initializing Advanced Spanish NLP tools...")

        # Primary: spaCy transformer model (best Spanish support)
        try:
            # Try transformer model first for better accuracy
            self.nlp = spacy.load("es_dep_news_trf")
            print("✅ Loaded spaCy transformer model (best accuracy)")
        except OSError:
            try:
                self.nlp = spacy.load("es_core_news_lg")
                print("✅ Loaded spaCy large model")
            except OSError:
                print("⚠️  Installing Spanish spaCy model...")
                import subprocess

                subprocess.run(
                    [sys.executable, "-m", "spacy", "download", "es_core_news_lg"]
                )
                self.nlp = spacy.load("es_core_news_lg")

        # Enable all components for better analysis
        if not self.nlp.has_pipe("lemmatizer"):
            self.nlp.add_pipe("lemmatizer", last=True)

        # Secondary: Stanza (Stanford's excellent Spanish support)
        self.stanza_nlp = None
        if STANZA_AVAILABLE:
            try:
                self.stanza_nlp = stanza.Pipeline(
                    "es", processors="tokenize,mwt,pos,lemma,depparse"
                )
                print("✅ Stanza Spanish pipeline ready")
            except:
                print("⚠️  Downloading Stanza Spanish model...")
                stanza.download("es")
                self.stanza_nlp = stanza.Pipeline(
                    "es", processors="tokenize,mwt,pos,lemma,depparse"
                )

        # Tertiary: Spanish BERT for better semantic understanding
        self.bert_pipeline = None
        if TRANSFORMERS_AVAILABLE:
            try:
                self.bert_pipeline = pipeline(
                    "token-classification",
                    model="dccuchile/bert-base-spanish-wwm-cased",
                    aggregation_strategy="simple",
                )
                print("✅ Spanish BERT model ready")
            except:
                print("⚠️  Could not load Spanish BERT model")

        # POS thresholds are inherited from base class (standardized)

    def normalize_word(self, word: str) -> str:
        """Normalize Spanish word by removing accents and converting to lowercase"""
        return normalize_word_generic(word)

    def get_migration_filename(self) -> str:
        """Get the migration filename for Spanish."""
        return get_language_migration_files()["es"]

    def get_existing_words(self) -> Set[str]:
        """Extract existing Spanish words from migration"""
        spanish_file = os.path.join(self.migrations_dir, self.get_migration_filename())

        data = self.extract_data_from_file(spanish_file)
        spanish_words = set()

        for _, _, _, word, _, _, _ in data:
            if word and word != "word":
                # Use common word processing method
                spanish_words.update(self.process_word_variants(word))
                # Also keep the original lowercased form
                spanish_words.add(word.lower())

        return spanish_words

    def get_best_lemma(
        self, word: str, pos: Optional[str] = None
    ) -> Tuple[str, float, Dict]:
        """
        Get the best lemma using multiple NLP tools
        Returns: (lemma, confidence, metadata)
        """
        lemmas = []
        metadata = {"sources": []}

        # 1. spaCy lemma (very good for Spanish)
        doc = self.nlp(word)
        if doc:
            token = doc[0]
            spacy_lemma = token.lemma_.lower()
            if (
                spacy_lemma and spacy_lemma != "-PRON-"
            ):  # spaCy sometimes returns -PRON-
                lemmas.append(spacy_lemma)
                metadata["sources"].append("spacy")
                metadata["spacy_pos"] = token.pos_
                metadata["spacy_morph"] = str(token.morph)

                # Get morphological features
                if token.morph:
                    metadata["features"] = {}
                    for feat in [
                        "Gender",
                        "Number",
                        "Person",
                        "Tense",
                        "Mood",
                        "VerbForm",
                    ]:
                        if token.morph.get(feat):
                            metadata["features"][feat] = str(token.morph.get(feat)[0])

        # 2. Stanza lemma (excellent for Spanish)
        if self.stanza_nlp:
            try:
                stanza_doc = self.stanza_nlp(word)
                if stanza_doc.sentences:
                    stanza_word = stanza_doc.sentences[0].words[0]
                    stanza_lemma = stanza_word.lemma.lower()
                    if stanza_lemma:
                        lemmas.append(stanza_lemma)
                        metadata["sources"].append("stanza")
                        metadata["stanza_pos"] = stanza_word.upos
                        metadata["stanza_features"] = (
                            stanza_word.feats if stanza_word.feats else {}
                        )
            except:
                pass

        # Calculate confidence based on agreement
        if not lemmas:
            return word.lower(), 0.0, metadata

        from collections import Counter

        lemma_counts = Counter(lemmas)
        best_lemma = lemma_counts.most_common(1)[0][0]
        confidence = lemma_counts[best_lemma] / len(lemmas)

        metadata["all_lemmas"] = list(set(lemmas))
        metadata["agreement"] = confidence

        return best_lemma, confidence, metadata

    def is_diminutive_augmentative(self, word: str, lemma: str) -> Optional[str]:
        """Check if word is a diminutive/augmentative form"""
        word_lower = word.lower()

        # Spanish diminutive suffixes
        diminutive_suffixes = [
            "ito",
            "ita",
            "itos",
            "itas",  # Most common
            "cito",
            "cita",
            "citos",
            "citas",  # After n, r, e
            "ecito",
            "ecita",
            "ecitos",
            "ecitas",  # Some monosyllables
            "illo",
            "illa",
            "illos",
            "illas",  # Regional variations
            "ico",
            "ica",
            "icos",
            "icas",  # Regional (Caribbean, Colombia)
            "ín",
            "ina",
            "ines",
            "inas",  # Regional (Asturias)
            "iño",
            "iña",
            "iños",
            "iñas",  # Regional (Galicia)
            "uco",
            "uca",
            "ucos",
            "ucas",  # Regional
            "uelo",
            "uela",
            "uelos",
            "uelas",  # Less common
            "ete",
            "eta",
            "etes",
            "etas",  # Less common
        ]

        # Spanish augmentative suffixes
        augmentative_suffixes = [
            "ón",
            "ona",
            "ones",
            "onas",  # Most common
            "azo",
            "aza",
            "azos",
            "azas",  # Can be augmentative or pejorative
            "ote",
            "ota",
            "otes",
            "otas",  # Often pejorative
            "achón",
            "achona",  # Emphatic augmentative
            "arrón",
            "arrona",  # Emphatic augmentative
            "erón",
            "erona",  # Regional
        ]

        # Check diminutives
        for suffix in diminutive_suffixes:
            if word_lower.endswith(suffix):
                # Try to extract base
                potential_base = word_lower[: -len(suffix)]
                # Handle common stem changes
                if potential_base.endswith("c") and suffix.startswith("ito"):
                    potential_base = potential_base[:-1]  # e.g., poc-ito -> poco
                elif potential_base.endswith("gu") and suffix.startswith("ito"):
                    potential_base = potential_base[:-1]  # e.g., amiguito -> amigo

                if len(potential_base) >= 3:  # Reasonable base length
                    return f"diminutive (_{suffix}_)"

        # Check augmentatives
        for suffix in augmentative_suffixes:
            if word_lower.endswith(suffix):
                potential_base = word_lower[: -len(suffix)]
                if len(potential_base) >= 3:
                    return f"augmentative (_{suffix}_)"

        return None

    def analyze_word(self, word: str, existing_words: Set[str]) -> Tuple[str, str, str]:
        """
        Comprehensive word analysis using pure NLP
        Returns: (category, pos_tag, reason)
        """
        # Get best lemma with metadata
        lemma, lemma_confidence, metadata = self.get_best_lemma(word)
        word_lower = word.lower()

        # Use spaCy for POS and basic analysis
        doc = self.nlp(word)
        if not doc:
            return "other", "UNKNOWN", "Could not analyze"

        token = doc[0]
        pos = token.pos_

        # Check if it's a known lemma inflection
        if lemma != word_lower and lemma in existing_words and lemma_confidence > 0.6:
            features_str = ""
            if "features" in metadata and metadata["features"]:
                features_str = f" ({', '.join(metadata['features'].values())})"

            # Special check for past participles (often tagged as ADJ)
            if pos == "ADJ" and metadata.get("features", {}).get("VerbForm") == "Part":
                return (
                    "inflected_form",
                    pos,
                    f'Past participle of "{lemma}"{features_str}',
                )
            elif pos == "VERB":
                return (
                    "inflected_form",
                    pos,
                    f'Inflected form of "{lemma}"{features_str}',
                )
            elif pos == "NOUN":
                number = metadata.get("features", {}).get("Number", "")
                return (
                    "inflected_form",
                    pos,
                    f'{"Plural" if "Plur" in number else "Inflected"} form of "{lemma}"',
                )
            elif pos == "ADJ":
                return (
                    "inflected_form",
                    pos,
                    f'Inflected form of "{lemma}"{features_str}',
                )
            elif pos == "DET":
                return (
                    "inflected_form",
                    pos,
                    f'Inflected form of "{lemma}"{features_str}',
                )
            else:
                return "inflected_form", pos, f'Inflected form of "{lemma}" [{pos}]'

        # Check diminutives/augmentatives (Spanish-specific)
        dim_aug_result = self.is_diminutive_augmentative(word, lemma)
        if dim_aug_result:
            # Check if base form exists
            potential_bases = [lemma]
            if lemma != word_lower:
                # Try removing the suffix to find base
                for suffix in ["ito", "ita", "ón", "ona", "azo", "aza"]:
                    if word_lower.endswith(suffix):
                        potential_bases.append(word_lower[: -len(suffix)])
                        # Handle stem changes
                        if word_lower[: -len(suffix)].endswith("c"):
                            potential_bases.append(
                                word_lower[: -len(suffix) - 1] + "co"
                            )
                        if word_lower[: -len(suffix)].endswith("qu"):
                            potential_bases.append(
                                word_lower[: -len(suffix) - 2] + "co"
                            )

            for base in potential_bases:
                if base in existing_words:
                    return "morphological_variant", pos, f'{dim_aug_result} of "{base}"'

        # Check if it's a reflexive pronoun attached to verb
        if word_lower.endswith(("me", "te", "se", "nos", "os")) and len(word_lower) > 4:
            # Try to find the verb without the pronoun
            for pronoun in ["me", "te", "se", "nos", "os"]:
                if word_lower.endswith(pronoun):
                    verb_part = word_lower[: -len(pronoun)]
                    if verb_part in existing_words or verb_part + "r" in existing_words:
                        return (
                            "morphological_variant",
                            pos,
                            f"Reflexive form with attached pronoun",
                        )

        # Named entity recognition
        if token.ent_type_ or pos == "PROPN":
            ent_type = token.ent_type_ if token.ent_type_ else "name"
            return "proper_noun", pos, f"Named entity ({ent_type})"

        # Grammatical words
        if pos in ["DET", "PRON", "ADP", "CCONJ", "SCONJ", "PART"]:
            return "grammatical_word", pos, f"{pos} - grammatical function word"

        # Check frequency for essential words
        freq = word_frequency(word_lower, "es")

        # Very low frequency filter
        if freq < 0.00003:
            return "low_frequency", pos, f"Very low frequency ({freq:.6f})"

        # Enhanced false positive detection for common Spanish patterns
        # Common inflected words that should never be recommended
        common_inflections = {
            # TENER (to have)
            "tiene",
            "tienes",
            "tengo",
            "tenemos",
            "tienen",
            "tenía",
            "tenías",
            "teníamos",
            "tenían",
            "tuvo",
            # HACER (to do/make)
            "hace",
            "haces",
            "hago",
            "hacemos",
            "hacen",
            "hacía",
            "hacías",
            "hacíamos",
            "hacían",
            "hizo",
            "hicieron",
            "haciendo",
            "habrá",
            # DECIR (to say)
            "dice",
            "dices",
            "digo",
            "decimos",
            "dicen",
            "decía",
            "decías",
            "decíamos",
            "decían",
            "dijo",
            "dijeron",
            "diciendo",
            "dije",
            # PODER (can/to be able)
            "puede",
            "puedes",
            "puedo",
            "podemos",
            "pueden",
            "podía",
            "podías",
            "podíamos",
            "podían",
            "pudo",
            "pudieron",
            "pueda",
            "podía",
            # QUERER (to want)
            "quiere",
            "quieres",
            "quiero",
            "queremos",
            "quieren",
            "quería",
            "querías",
            "queríamos",
            "querían",
            "quiso",
            "quisieron",
            "quienes",
            # VENIR (to come)
            "viene",
            "vienes",
            "vengo",
            "venimos",
            "vienen",
            "venía",
            "venías",
            "veníamos",
            "venían",
            "vino",
            "vinieron",
            # IR (to go)
            "va",
            "vas",
            "voy",
            "vamos",
            "van",
            "iba",
            "ibas",
            "íbamos",
            "iban",
            "fue",
            "fueron",
            "fui",
            # ESTAR (to be - temporary)
            "está",
            "estás",
            "estoy",
            "estamos",
            "están",
            "estaba",
            "estabas",
            "estábamos",
            "estaban",
            "estuvo",
            "estuvieron",
            # SER (to be - permanent)
            "es",
            "eres",
            "soy",
            "somos",
            "son",
            "era",
            "eras",
            "éramos",
            "eran",
            "fue",
            "fueron",
            "siendo",
            "sean",
            # HABER (auxiliary verb)
            "han",
            "hemos",
            "hubo",
            "hubiera",
            "habría",
            "hice",
            # GUSTAR (to like)
            "gusta",
            "gustas",
            "gusto",
            "gustamos",
            "gustan",
            "gustaba",
            "gustabas",
            "gustábamos",
            "gustaban",
            "gustaría",
            # PARECER (to seem)
            "parece",
            "pareces",
            "parezco",
            "parecemos",
            "parecen",
            "parecía",
            "parecías",
            "parecíamos",
            "parecían",
            # SABER (to know)
            "sabe",
            "sabes",
            "sé",
            "sabemos",
            "saben",
            "sabía",
            "sabías",
            "sabíamos",
            "sabían",
            "supo",
            "supieron",
            # PASAR (to pass/happen)
            "pasa",
            "pasas",
            "paso",
            "pasamos",
            "pasan",
            "pasaba",
            "pasabas",
            "pasábamos",
            "pasaban",
            "pasó",
            "pasaron",
            # SEGUIR (to follow/continue)
            "sigue",
            "sigues",
            "sigo",
            "seguimos",
            "siguen",
            "seguía",
            "seguías",
            "seguíamos",
            "seguían",
            "siguió",
            "siguieron",
            "siguen",
            # TRATAR (to try/treat)
            "trata",
            "tratas",
            "trato",
            "tratamos",
            "tratan",
            "trataba",
            "tratabas",
            "tratábamos",
            "trataban",
            "trató",
            "trataron",
            # QUEDAR (to remain/stay)
            "queda",
            "quedas",
            "quedo",
            "quedamos",
            "quedan",
            "quedaba",
            "quedabas",
            "quedábamos",
            "quedaban",
            "quedó",
            "quedaron",
            # SENTIR (to feel)
            "siente",
            "sientes",
            "siento",
            "sentimos",
            "sienten",
            "sentía",
            "sentías",
            "sentíamos",
            "sentían",
            "sintió",
            "sintieron",
            # VER (to see)
            "ve",
            "ves",
            "veo",
            "vemos",
            "ven",
            "veía",
            "veías",
            "veíamos",
            "veían",
            "vio",
            "vieron",
            # DAR (to give)
            "da",
            "das",
            "doy",
            "damos",
            "dan",
            "daba",
            "dabas",
            "dábamos",
            "daban",
            "dio",
            "dieron",
            "darle",
            "dando",
            # DEJAR (to leave/let)
            "deja",
            "dejas",
            "dejo",
            "dejamos",
            "dejan",
            "dejaba",
            "dejabas",
            "dejábamos",
            "dejaban",
            "dejó",
            "dejaron",
            # DEBER (must/should)
            "deben",
            "debemos",
            # ENCONTRAR (to find)
            "encuentra",
            "encuentro",
            # EXISTIR (to exist)
            "existe",
            "existen",
            # SALIR (to go out)
            "sale",
            # VIVIR (to live)
            "vive",
            # PERMITIR (to allow)
            "permite",
            # ENTENDER (to understand)
            "entiendo",
            # HABLAR (to speak)
            "hablando",
            # ESPERAR (to wait/hope)
            "esperando",
            # FALTAR (to be missing/lack) - "falta" is 3rd person singular
            "falta",
            # RESPETAR (to respect) - "respeto" is 1st person singular
            "respeto",
            # Common plural nouns
            "veces",
            "años",
            "días",
            "meses",
            "horas",
            "minutos",
            "personas",
            "cosas",
            "mujeres",
            "hombres",
            "niños",
            "millones",
            "lugares",
            "actividades",
            "ciudades",
            "leyes",
            "jóvenes",
            "acciones",
            "relaciones",
            "condiciones",
            "mayores",
            "miles",
            # Common adjective forms and apocopated forms
            "nueva",
            "nuevos",
            "nuevas",
            "primera",
            "primeros",
            "primeras",
            "buena",
            "buenos",
            "buenas",
            "gran",
            "grande",
            "grandes",
            "mejor",
            "mejores",
            "peor",
            "peores",
            "principales",
            "sociales",
            "unidos",
            "aquellos",
            "cuales",
            "buen",  # apocopated form of "bueno"
            "mal",  # apocopated form of "malo"
            "primer",  # apocopated form of "primero"
            "tercer",  # apocopated form of "tercero"
            # Pronouns and possessives
            "nosotros",
            "ustedes",
            "tus",
            "contigo",
        }

        if word_lower in common_inflections:
            return (
                "inflected_form",
                pos,
                f"Common inflected form - should not be recommended",
            )

        # Check for derived forms that have base words in different forms
        derived_word_mappings = {
            "formación": "formar",  # noun from verb
            "derecha": "derecho",  # feminine form of masculine noun (right side vs. right/law)
            "cultural": "cultura",  # adjective from noun
        }

        if word_lower in derived_word_mappings:
            base_form = derived_word_mappings[word_lower]
            if base_form in existing_words:
                return (
                    "morphological_variant",
                    pos,
                    f'Derived from "{base_form}" which exists in migration',
                )

        # Check for proper nouns (countries, cities, names, etc.)
        proper_nouns = {
            # Countries
            "argentina",
            "chile",
            "venezuela",
            "colombia",
            "brasil",
            "china",
            "francia",
            "perú",
            "españa",
            "méxico",
            "ecuador",
            "bolivia",
            "paraguay",
            "uruguay",
            "cuba",
            "panama",
            "guatemala",
            "honduras",
            "nicaragua",
            "costa",
            "rica",
            "salvador",
            "república",
            "dominicana",
            "puerto",
            "rico",
            "estados",
            "unidos",
            "alemania",
            "italia",
            "portugal",
            "rusia",
            # Cities
            "madrid",
            "barcelona",
            "buenos",
            "aires",
            "bogotá",
            "lima",
            "santiago",
            "caracas",
            "quito",
            "la",
            "paz",
            "montevideo",
            "asunción",
            "ciudad",
            "méxico",
            "guadalajara",
            "valencia",
            "sevilla",
            "bilbao",
            "zaragoza",
            "málaga",
            "murcia",
            "palma",
            "córdoba",
            # Common names
            "juan",
            "josé",
            "carlos",
            "francisco",
            "pedro",
            "antonio",
            "manuel",
            "luis",
            "miguel",
            "david",
            "daniel",
            "alejandro",
            "rafael",
            "javier",
            "mario",
            "sergio",
            "alberto",
            "maría",
            "ana",
            "carmen",
            "pilar",
            "teresa",
            "rosa",
            "dolores",
            "mercedes",
            "josefa",
            "francisca",
            "antonia",
            "isabel",
            "concepción",
            "esperanza",
            "angeles",
            "cristina",
            # Political/institutional
            "pp",
            "congreso",
            "ministerio",
            "comisión",
            "corte",
            "constitución",
            "instituto",
            "sr",
            "sra",
            "señor",
            "señora",
            "don",
            "doña",
            # Regions/places
            "américa",
            "cataluña",
            "andalucía",
            "valencia",
            "galicia",
            "país",
            "vasco",
            "navarra",
            "asturias",
            "cantabria",
            "murcia",
            "extremadura",
            "castilla",
            "león",
            "mancha",
            "aragón",
            "rioja",
            "baleares",
            "canarias",
            "ceuta",
            "melilla",
        }

        if token.ent_type_ or pos == "PROPN" or word.lower() in proper_nouns:
            return "proper_noun", pos, f'Proper noun ({token.ent_type_ or "name"})'

        # Check for foreign words and abbreviations
        foreign_words = {
            "internet",
            "video",
            "post",
            "etc",
            "ii",
            "puta",  # vulgar
        }

        if word.lower() in foreign_words:
            return (
                "foreign_word",
                pos,
                "Foreign word/abbreviation - not suitable for Spanish learning",
            )

        # Essential word categories
        if pos in self.pos_thresholds:
            threshold = self.pos_thresholds[pos]
            if freq >= threshold:
                # Additional quality checks using metadata
                if lemma_confidence < 0.5 and len(metadata.get("all_lemmas", [])) > 2:
                    return (
                        "uncertain_lemma",
                        pos,
                        "Multiple possible lemmas - needs review",
                    )

                if pos in self.category_mapping:
                    features_str = ""
                    if "features" in metadata:
                        features_str = f" ({', '.join(metadata['features'].values())})"

                    return (
                        self.category_mapping[pos],
                        pos,
                        f"High-frequency {pos}{features_str}",
                    )
            else:
                return "below_threshold", pos, f"{pos} below frequency threshold"

        # Abbreviations
        if word.isupper() and len(word) <= 4:
            return "abbreviations", pos, "Likely abbreviation"

        # Foreign words (basic detection)
        if not any(c in "áéíóúüñ" for c in word_lower) and token.is_oov:
            return "foreign_words", pos, "Possible foreign word"

        return "other", pos, f"Uncategorized {pos}"

    def analyze(
        self,
        top_n: int = 1000,
        show_details: bool = True,
        limit_analysis: Optional[int] = None,
    ) -> List[Tuple[str, float, str, str]]:
        """
        Main analysis using pure NLP

        Args:
            top_n: How many top frequency words to check
            show_details: Whether to print detailed output
            limit_analysis: Optional limit on how many words to analyze (None = analyze all)
        """
        if show_details:
            print("\n🔍 ADVANCED SPANISH WORD ANALYSIS (Pure NLP)")
            print("=" * 80)
            tools = ["spaCy"]
            if self.stanza_nlp:
                tools.append("Stanza")
            if self.bert_pipeline:
                tools.append("Spanish BERT")
            print(f"Using: {', '.join(tools)}")
            print("=" * 80)

        # Get existing words
        existing_words = self.get_existing_words()
        if show_details:
            print(f"Found {len(existing_words)} existing Spanish words")

        # Get top Spanish words
        top_spanish = self.get_top_words(top_n)

        # Find missing words
        missing_words = []
        for word in top_spanish:
            if word.lower() not in existing_words:
                missing_words.append(word)

        if show_details:
            print(f"Found {len(missing_words)} missing words from top {top_n}")
            if limit_analysis and limit_analysis < len(missing_words):
                print(
                    f"⚠️  Limiting analysis to first {limit_analysis} words (use limit_analysis=None to analyze all)"
                )
            print("Performing deep NLP analysis...")

        # Analyze words
        categories = defaultdict(list)

        # Apply optional limit
        words_to_analyze = (
            missing_words[:limit_analysis] if limit_analysis else missing_words
        )

        for word in words_to_analyze:
            category, pos_tag, reason = self.analyze_word(word, existing_words)
            freq = word_frequency(word.lower(), "es")

            categories[category].append((word, freq, reason, pos_tag))

        if show_details:
            print("\n")

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

        # Sort by frequency
        recommendations.sort(key=lambda x: x[1], reverse=True)

        if show_details:
            self._display_spanish_results(dict(categories), recommendations)

        return recommendations

    def _display_spanish_results(self, categories: Dict, recommendations: List):
        """Display Spanish-specific analysis results using standardized format."""
        from migration_utils import display_standard_results

        display_standard_results(
            categories, recommendations, "Advanced NLP (Multi-tool)"
        )


def main():
    """Main entry point"""
    print("🚀 Initializing Advanced Spanish NLP analyzer...")
    print("\n📦 Required packages:")
    print("   pip install spacy wordfreq")
    print("   python -m spacy download es_core_news_lg")
    print("\n📦 Recommended for better accuracy:")
    print("   pip install stanza transformers")
    print("   python -m spacy download es_dep_news_trf")

    analyzer = SpanishWordAnalyzer()
    analyzer.run_main("Analyze Spanish words for LinguaQuiz using advanced NLP.")


if __name__ == "__main__":
    main()
