"""
Configuration constants for vocabulary analysis.

Loads configuration from config.yaml file for flexibility and maintainability.
"""

from pathlib import Path
from typing import Dict, Set

import yaml


def _load_config() -> Dict:
    """Load configuration from config.yaml file."""
    # Look for config.yaml in the project root (parent of vocab_tools)
    config_path = Path(__file__).parent.parent.parent / "config.yaml"

    if not config_path.exists():
        raise FileNotFoundError(f"Configuration file not found at {config_path}")

    with open(config_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


# Load configuration once at module import
_CONFIG = _load_config()

# Analysis thresholds for part-of-speech categorization
POS_ANALYSIS_THRESHOLDS = _CONFIG["pos_analysis_thresholds"]

# Category mapping for word classification
WORD_CATEGORY_MAPPING = _CONFIG["word_categories"]

# Essential categories for vocabulary learning (ordered by priority)
ESSENTIAL_VOCABULARY_CATEGORIES = _CONFIG["essential_vocabulary_categories"]

# Common skip words for analysis (converted to set for performance)
ANALYSIS_SKIP_WORDS: Set[str] = set(_CONFIG["skip_words"])

# NLP model preferences (in order of preference)
NLP_MODEL_PREFERENCES = _CONFIG["nlp_models"]

# Default analysis parameters
DEFAULT_ANALYSIS_CONFIG = _CONFIG["analysis_defaults"]

# Languages and CEFR levels from config
SUPPORTED_LANGUAGES = _CONFIG["languages"]
CEFR_LEVELS = _CONFIG["cefr_levels"]
