"""
Pydantic models for configuration validation.

Provides type-safe access to config.yaml with runtime validation.
"""

from pydantic import BaseModel, Field, field_validator


class AnalysisDefaults(BaseModel):
    """Analysis default settings."""

    min_word_length: int = Field(ge=1, le=10)
    max_word_length: int = Field(ge=5, le=100)
    frequency_threshold: float = Field(gt=0)
    top_words_count: int = Field(ge=100)
    id_gap_threshold: int = Field(ge=10)


class CEFRLevel(BaseModel):
    """CEFR level configuration."""

    words: int = Field(ge=0)
    rank_range: list[int] = Field(min_length=2, max_length=2)
    zipf_threshold: float = Field(ge=0, le=10)
    coverage_target: str
    description: str

    @field_validator("rank_range")
    @classmethod
    def validate_rank_range(cls, v: list[int]) -> list[int]:
        """Validate rank_range has start < end."""
        if v[0] >= v[1]:
            raise ValueError("rank_range start must be less than end")
        return v


class Normalization(BaseModel):
    """Normalization rules for text processing."""

    unicode_normalization_form: str = Field(pattern="^(NFC|NFD|NFKC|NFKD)$")
    preserve_diacritics: bool
    articles: list[str] = Field(default_factory=list)
    remove_hyphens: bool
    comma_separator: bool
    special_chars: list[str] = Field(default_factory=list)


class InflectionPatterns(BaseModel):
    """Inflection patterns for filtering."""

    plural_noun: list[str] = Field(default_factory=list)
    past_tense: list[str] = Field(default_factory=list)
    past_participle: list[str] = Field(default_factory=list)
    present_participle: list[str] = Field(default_factory=list)
    comparative: list[str] = Field(default_factory=list)
    superlative: list[str] = Field(default_factory=list)
    third_person: list[str] = Field(default_factory=list)


class LemmatizationExceptions(BaseModel):
    """Lemmatization exception rules."""

    short_lemmas: list[str]
    reason: str


class Blacklist(BaseModel):
    """Blacklisted words by category."""

    contractions: list[str] = Field(default_factory=list)
    profanity: list[str]
    abbreviations: list[str]
    interjections: list[str]
    anglicisms: list[str] = Field(default_factory=list)
    slang: list[str] = Field(default_factory=list)
    proper_nouns: list[str]
    technical: list[str] = Field(default_factory=list)
    lemma_errors: list[str] = Field(default_factory=list)
    too_short: list[str] = Field(default_factory=list)


class Filtering(BaseModel):
    """Filtering configuration."""

    min_word_length: int = Field(ge=1, le=10)
    short_word_whitelist: list[str]
    inflection_frequency_ratio: float = Field(ge=0, le=1)
    raw_frequency_multiplier: float = Field(default=2.5, ge=1.0, le=10.0)
    test_whitelist: list[str]
    ner_frequency_threshold: float | None = Field(default=None, ge=0, le=1)
    exclude_patterns: list[str] = Field(default_factory=list)


class POSCategories(BaseModel):
    """Part-of-speech tag categories."""

    essential_nouns: list[str]
    essential_verbs: list[str]
    essential_adjectives: list[str]
    function_words: list[str]
    modifiers: list[str] = Field(default_factory=list)
    connectors: list[str] = Field(default_factory=list)


class LanguageConfig(BaseModel):
    """Configuration for a specific language."""

    name: str
    wordfreq_code: str
    spacy_models: list[str] = Field(min_length=1)
    stanza_code: str | None = None

    normalization: Normalization
    inflection_patterns: InflectionPatterns
    lemmatization_exceptions: LemmatizationExceptions
    skip_words: list[str] = Field(default_factory=list)
    blacklist: Blacklist
    filtering: Filtering
    pos_categories: POSCategories

    @field_validator("wordfreq_code")
    @classmethod
    def validate_wordfreq_code(cls, v: str) -> str:
        """Validate wordfreq code is lowercase."""
        if not v.islower():
            raise ValueError("wordfreq_code must be lowercase")
        return v


class Config(BaseModel):
    """Root configuration model."""

    analysis_defaults: AnalysisDefaults
    cefr_levels: dict[str, CEFRLevel]
    cefr_cumulative_totals: dict[str, int]
    languages: dict[str, LanguageConfig]

    @field_validator("cefr_levels")
    @classmethod
    def validate_cefr_levels(cls, v: dict[str, CEFRLevel]) -> dict[str, CEFRLevel]:
        """Validate CEFR levels are present."""
        required_levels = {"a1", "a2", "b1", "b2"}
        missing = required_levels - set(v.keys())
        if missing:
            raise ValueError(f"Missing required CEFR levels: {missing}")
        return v

    @field_validator("cefr_cumulative_totals")
    @classmethod
    def validate_cefr_cumulative_totals(cls, v: dict[str, int]) -> dict[str, int]:
        """Validate CEFR cumulative totals are present and values are increasing."""
        required_levels = {"a1", "a2", "b1", "b2"}
        missing = required_levels - set(v.keys())
        if missing:
            raise ValueError(f"Missing required CEFR cumulative totals: {missing}")

        # Validate all values are non-negative
        for level, count in v.items():
            if count < 0:
                raise ValueError(f"CEFR cumulative total for {level} must be non-negative, got {count}")

        # Validate values are increasing for standard progression
        standard_order = ["a0", "a1", "a2", "b1", "b2", "c1", "c2"]
        prev_count = -1
        for level in standard_order:
            if level in v:
                if v[level] < prev_count:
                    raise ValueError(
                        f"CEFR cumulative totals must be non-decreasing: {level}={v[level]} < previous={prev_count}"
                    )
                prev_count = v[level]

        return v

    @field_validator("languages")
    @classmethod
    def validate_languages(cls, v: dict[str, LanguageConfig]) -> dict[str, LanguageConfig]:
        """Validate at least one language is configured."""
        if not v:
            raise ValueError("At least one language must be configured")
        return v

    def get_language(self, code: str) -> LanguageConfig | None:
        """
        Get language configuration by code.

        Args:
            code: Language code (e.g., 'en', 'es')

        Returns:
            LanguageConfig or None if not found
        """
        return self.languages.get(code)

    def get_cefr_level(self, level: str) -> CEFRLevel | None:
        """
        Get CEFR level configuration.

        Args:
            level: CEFR level code (e.g., 'a1', 'b2')

        Returns:
            CEFRLevel or None if not found
        """
        return self.cefr_levels.get(level.lower())

    def get_all_blacklist_words(self, language_code: str) -> list[str]:
        """
        Get all blacklisted words for a language (flattened).

        Args:
            language_code: Language code (e.g., 'en')

        Returns:
            List of all blacklisted words
        """
        lang_config = self.get_language(language_code)
        if not lang_config:
            return []

        blacklist = lang_config.blacklist
        all_words = []

        # Flatten all blacklist categories
        all_words.extend(blacklist.contractions)
        all_words.extend(blacklist.profanity)
        all_words.extend(blacklist.abbreviations)
        all_words.extend(blacklist.interjections)
        all_words.extend(blacklist.anglicisms)
        all_words.extend(blacklist.slang)
        all_words.extend(blacklist.proper_nouns)
        all_words.extend(blacklist.technical)
        all_words.extend(blacklist.lemma_errors)
        all_words.extend(blacklist.too_short)

        return all_words
