from pathlib import Path

from pydantic import ValidationError
import yaml

from .models import Config


class ConfigLoader:
    """
    Singleton configuration loader with Pydantic validation.

    Loads config.yaml and validates it against Pydantic models,
    providing type-safe access to configuration values.
    """

    _instance = None
    _config: Config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        """Load and validate configuration from config.yaml."""
        config_path = Path(__file__).parent.parent.parent / "config.yaml"

        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found at {config_path}")

        try:
            with open(config_path, encoding="utf-8") as f:
                raw_config = yaml.safe_load(f)

            # Validate with Pydantic
            self._config = Config(**raw_config)

        except ValidationError as e:
            raise ValueError(f"Configuration validation failed:\n{e}") from e

    @property
    def config(self) -> Config:
        """Get validated configuration model."""
        return self._config

    def get_language_config(self, language_code: str) -> dict:
        """
        Get language configuration as dict (backwards compatible).

        Args:
            language_code: Language code (e.g., 'en')

        Returns:
            Language configuration dict

        Raises:
            ValueError: If language is not configured
        """
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.model_dump()

    def get_supported_languages(self) -> list[str]:
        """Get list of configured language codes."""
        return list(self._config.languages.keys())

    def get_analysis_defaults(self) -> dict:
        """Get analysis default settings as dict."""
        return self._config.analysis_defaults.model_dump()

    def get_essential_vocabulary_categories(self) -> list[str]:
        """
        Get essential vocabulary categories.

        Note: This is deprecated, kept for backwards compatibility.
        Use POS categories from language config instead.
        """
        return []

    def get_language_name(self, language_code: str) -> str:
        """Get display name for language."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.name

    def get_wordfreq_code(self, language_code: str) -> str:
        """Get wordfreq library code for language."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            return language_code
        return lang_config.wordfreq_code

    def get_spacy_models(self, language_code: str) -> list[str]:
        """Get list of spaCy models for language."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.spacy_models

    def get_skip_words(self, language_code: str) -> set[str]:
        """Get set of words to skip during processing."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            return set()
        return set(lang_config.skip_words)

    def get_pos_categories(self, language_code: str) -> dict:
        """Get POS tag categories as dict."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.pos_categories.model_dump()

    def get_inflection_patterns(self, language_code: str) -> dict:
        """Get inflection patterns as dict."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.inflection_patterns.model_dump()

    def get_blacklist_words(self, language_code: str) -> list[str]:
        """Get all blacklisted words for language (flattened)."""
        return self._config.get_all_blacklist_words(language_code)

    def get_filtering_config(self, language_code: str) -> dict:
        """Get filtering configuration as dict."""
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            raise ValueError(f"Unsupported language code: {language_code}")
        return lang_config.filtering.model_dump()

    def get_cumulative_total(self, level: str) -> int:
        """
        Get cumulative word count for CEFR level.

        Returns the total number of lemmas from A1 up to and including the specified level.
        Example: For B1, returns 4000 (A1=1000 + A2=1000 + B1=2000)

        Args:
            level: CEFR level code (e.g., 'a1', 'b2')

        Returns:
            Cumulative word count, or 1500 as fallback

        Examples:
            >>> config_loader.get_cumulative_total('a1')
            1000
            >>> config_loader.get_cumulative_total('b1')
            4000
        """
        cumulative_totals = self._config.cefr_cumulative_totals
        return cumulative_totals.get(level.lower(), 1500)

    def get_raw_frequency_multiplier(self, language_code: str) -> float:
        """
        Get multiplier for raw frequency data to account for inflection filtering.

        Different languages have different degrees of inflection, requiring different
        amounts of raw data to achieve the target number of lemmas after filtering.

        Args:
            language_code: Language code (e.g., 'es', 'de', 'ru')

        Returns:
            Multiplier for raw frequency count (default: 2.5)

        Examples:
            >>> config_loader.get_raw_frequency_multiplier('es')
            2.5  # Spanish: medium inflection
            >>> config_loader.get_raw_frequency_multiplier('de')
            3.0  # German: high inflection
            >>> config_loader.get_raw_frequency_multiplier('ru')
            3.5  # Russian: very high inflection
        """
        lang_config = self._config.get_language(language_code)
        if not lang_config:
            return 2.5  # Default fallback
        return lang_config.filtering.raw_frequency_multiplier


def get_config_loader() -> ConfigLoader:
    """Get singleton ConfigLoader instance."""
    return ConfigLoader()
