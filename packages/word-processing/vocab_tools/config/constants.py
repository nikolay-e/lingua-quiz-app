"""
Configuration constants for vocabulary analysis.

Loads configuration from config.yaml file for flexibility and maintainability.
"""

from pathlib import Path

import yaml


def _load_config() -> dict:
    """Load configuration from config.yaml file."""
    # Look for config.yaml in the project root (parent of vocab_tools)
    config_path = Path(__file__).parent.parent.parent / "config.yaml"

    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found at {config_path}")

    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f)


# Load configuration once at module import
_CONFIG = _load_config()

# Category mapping for word classification
WORD_CATEGORY_MAPPING = _CONFIG["word_categories"]

# Essential categories for vocabulary learning (ordered by priority)
ESSENTIAL_VOCABULARY_CATEGORIES = _CONFIG["essential_vocabulary_categories"]

# Common skip words for analysis (converted to set for performance)
ANALYSIS_SKIP_WORDS: set[str] = set(_CONFIG["skip_words"])

# NLP model preferences (in order of preference)
NLP_MODEL_PREFERENCES = _CONFIG["nlp_models"]

# Default analysis parameters
DEFAULT_ANALYSIS_CONFIG = _CONFIG["analysis_defaults"]

# Supported languages from config
SUPPORTED_LANGUAGES = _CONFIG["languages"]

# Base POS descriptions (language-neutral)
BASE_POS_DESCRIPTIONS = {
    "NOUN": "noun",
    "PROPN": "proper noun",
    "VERB": "verb",
    "ADJ": "adjective",
    "ADV": "adverb",
    "DET": "determiner/article",
    "PRON": "pronoun",
    "ADP": "preposition",
    "CONJ": "conjunction",
    "SCONJ": "subordinating conjunction",
    "NUM": "number",
    "PART": "particle",
    "AUX": "auxiliary verb",
}
