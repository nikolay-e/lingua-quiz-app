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


# ============================================================================
# FREQUENCY RANKS & THRESHOLDS
# ============================================================================

# Rank assigned to words not found in frequency lists
RANK_NOT_FOUND = 999999

# Frequency rank thresholds for word categorization
RANK_CRITICAL = 100  # Critical missing words (top 100)
RANK_HIGH_PRIORITY = 500  # High priority words (top 500)
RANK_MEDIUM_PRIORITY = 1000  # Medium priority words (top 1000)
RANK_VERY_COMMON = 1000  # Very common words threshold
RANK_LEGITIMATE = 5000  # Legitimate vocabulary threshold
RANK_LOW_PRIORITY = 10000  # Low priority threshold
RANK_VERY_RARE = 10000  # Very rare words threshold


# ============================================================================
# BATCH PROCESSING
# ============================================================================

# Batch size for lemmatization operations
LEMMATIZATION_BATCH_SIZE = 1000

# Progress reporting interval for batch processing
BATCH_PROGRESS_INTERVAL = 5000  # Report every 5000 words
BATCH_PROGRESS_INTERVAL_LARGE = 10000  # For large datasets


# ============================================================================
# VALIDATION LIMITS
# ============================================================================

# Maximum word length in characters
MAX_WORD_LENGTH = 100

# History storage limits
MAX_STORED_RESULTS = 500  # Keep last 500 analysis runs


# ============================================================================
# DEDUPLICATION & FREQUENCY COMPARISON
# ============================================================================

# Frequency margin for replacement (20% higher to replace)
FREQUENCY_REPLACEMENT_MARGIN = 1.2


# ============================================================================
# FALLBACK VALUES
# ============================================================================

# Fallback cumulative total for unknown CEFR levels
FALLBACK_CUMULATIVE_TOTAL = 1500

# Default quality score for empty datasets
DEFAULT_QUALITY_SCORE = 100.0


# ============================================================================
# MIGRATION ID OFFSETS
# ============================================================================

# Base offsets for migration ID generation
# Used in vocabulary_exporter.py for deterministic ID assignment
MIGRATION_ID_BASE = 10000000
MIGRATION_SOURCE_ID_BASE = 10000001
MIGRATION_TARGET_ID_BASE = 10000002
MIGRATION_ID_STEP = 2  # Increment by 2 for each word pair


# ============================================================================
# CEFR LEVEL DEFINITIONS
# ============================================================================

# CEFR level hierarchy (for previous level calculations)
CEFR_LEVELS = ["a0", "a1", "a2", "b1", "b2", "c1", "c2", "d"]

# Default CEFR level for fallback
DEFAULT_CEFR_LEVEL = "a1"


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================


def is_critical_rank(rank: int) -> bool:
    """Check if rank is in critical range (top 100)."""
    return rank <= RANK_CRITICAL


def is_high_priority_rank(rank: int) -> bool:
    """Check if rank is in high priority range (top 500)."""
    return rank <= RANK_HIGH_PRIORITY


def is_medium_priority_rank(rank: int) -> bool:
    """Check if rank is in medium priority range (top 1000)."""
    return rank <= RANK_MEDIUM_PRIORITY


def is_rare_rank(rank: int) -> bool:
    """Check if rank indicates very rare word (> 10000)."""
    return rank > RANK_VERY_RARE


def get_priority_category(rank: int) -> str:
    """
    Get priority category for given rank.

    Args:
        rank: Frequency rank (1-based)

    Returns:
        Priority category: "CRITICAL", "HIGH", "MEDIUM", "LOW", or "VERY_RARE"
    """
    if rank <= RANK_CRITICAL:
        return "CRITICAL"
    if rank <= RANK_HIGH_PRIORITY:
        return "HIGH"
    if rank <= RANK_MEDIUM_PRIORITY:
        return "MEDIUM"
    if rank <= RANK_LOW_PRIORITY:
        return "LOW"
    return "VERY_RARE"
