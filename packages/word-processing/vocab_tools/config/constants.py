"""
Configuration constants for vocabulary analysis.

Loads configuration from config.yaml file for flexibility and maintainability.
"""

from pathlib import Path

import yaml

from .config_loader import get_config_loader


def _load_config() -> dict:
    config_path = Path(__file__).parent.parent.parent / "config.yaml"

    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found at {config_path}")

    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


_CONFIG = _load_config()
_config_loader = get_config_loader()

ESSENTIAL_VOCABULARY_CATEGORIES = _CONFIG["essential_vocabulary_categories"]

DEFAULT_ANALYSIS_CONFIG = _CONFIG["analysis_defaults"]

SUPPORTED_LANGUAGES = list(_CONFIG["languages"].keys())

_all_skip_words = set()
_all_pos_categories = {}
_all_nlp_models = {}

for lang_code in SUPPORTED_LANGUAGES:
    lang_config = _CONFIG["languages"][lang_code]
    _all_skip_words.update(lang_config["skip_words"])
    _all_nlp_models[lang_code] = lang_config["spacy_models"]

    if not _all_pos_categories:
        _all_pos_categories = lang_config["pos_categories"]

ANALYSIS_SKIP_WORDS: set[str] = _all_skip_words

WORD_CATEGORY_MAPPING = _all_pos_categories

NLP_MODEL_PREFERENCES = _all_nlp_models

BASE_POS_DESCRIPTIONS = {
    "NOUN": "noun",
    "PROPN": "proper noun",
    "VERB": "verb",
    "ADJ": "adjective",
    "ADV": "adverb",
    "DET": "determiner",
    "PRON": "pronoun",
    "ADP": "preposition",
    "CONJ": "conjunction",
    "SCONJ": "subordinating conjunction",
    "NUM": "number",
    "PART": "particle",
    "AUX": "auxiliary verb",
    "INTJ": "interjection",
}


def get_pos_description(pos_tag: str, language_prefix: str | None = None) -> str:
    """
    Get description for a POS tag.

    Args:
        pos_tag: Part-of-speech tag (e.g., "NOUN", "VERB")
        language_prefix: Optional language prefix (e.g., "German", "Spanish")

    Returns:
        Description string (e.g., "noun", "German noun", "Spanish verb")
    """
    base_description = BASE_POS_DESCRIPTIONS.get(pos_tag, "word")

    if language_prefix:
        return f"{language_prefix} {base_description}"

    return base_description
