"""
NLP model management for vocabulary analysis.

Handles loading and caching of spaCy NLP models with fallback support
for different model sizes and availability.
"""

import subprocess
import sys
from typing import Any

import spacy
from spacy.lang.de import German
from spacy.lang.en import English
from spacy.lang.es import Spanish
from spacy.lang.ru import Russian

from ..config.constants import NLP_MODEL_PREFERENCES


class NLPModelManager:
    """
    Manages loading and caching of NLP models for different languages.

    Provides fallback mechanism if preferred models are not available
    and caches loaded models for performance.
    """

    def __init__(self):
        self._model_cache: dict[str, Any] = {}
        self._download_attempted: set = set()

    def load_model(
        self,
        language_code: str,
        model_preferences: list[str] | None = None,
        silent: bool = False,
    ) -> Any:
        """
        Load the best available NLP model for a language.

        Args:
            language_code: ISO language code (en, de, es)
            model_preferences: List of model names to try (most preferred first).
                              If None, uses defaults from config.

        Returns:
            Loaded spaCy NLP model

        Raises:
            RuntimeError: If no suitable model can be loaded
        """
        # Return cached model if available
        if language_code in self._model_cache:
            return self._model_cache[language_code]

        if model_preferences is None:
            model_preferences = NLP_MODEL_PREFERENCES.get(language_code, [])

        # Try to load models in order of preference
        for model_name in model_preferences:
            try:
                if not silent:
                    print(f"  Attempting to load {model_name}...")
                model = spacy.load(model_name)
                self._validate_model_components(model, language_code)
                self._model_cache[language_code] = model
                if not silent:
                    print(f"  Successfully loaded {model_name}")
                return model
            except (OSError, RuntimeError) as e:
                if not silent:
                    print(f"  ⚠️  {model_name} not available or invalid: {e}")

                # Try to download the model automatically
                if self._download_model(model_name, silent=silent):
                    # Try loading again after download
                    try:
                        if not silent:
                            print(f"  Attempting to load {model_name} after download...")
                        model = spacy.load(model_name)
                        self._validate_model_components(model, language_code)
                        self._model_cache[language_code] = model
                        if not silent:
                            print(f"  Successfully loaded {model_name} after download")
                        return model
                    except (OSError, RuntimeError) as e:
                        if not silent:
                            print(f"  Still can't load or validate {model_name} after download: {e}")
                        continue

                continue

        # Fallback to basic language model if specific models fail
        if not silent:
            print(f"  Falling back to basic {language_code} model...")
        try:
            fallback_model = self._load_basic_model(language_code)
            if fallback_model:
                self._validate_model_components(fallback_model, language_code)
                self._model_cache[language_code] = fallback_model
                if not silent:
                    print(f"  Loaded basic {language_code} model")
                return fallback_model
        except Exception as e:
            if not silent:
                print(f"  Failed to load basic model: {e}")

        raise RuntimeError(
            f"Could not load any NLP model for language '{language_code}'. "
            f"Tried: {model_preferences}. Please install a spaCy model with: "
            f"python -m spacy download {model_preferences[0] if model_preferences else 'en_core_web_sm'}"
        )

    def _validate_model_components(self, model: Any, language_code: str) -> None:
        """
        Validate that the model has required components for vocabulary analysis.

        Args:
            model: Loaded spaCy model
            language_code: ISO language code

        Raises:
            RuntimeError: If model lacks essential components
        """
        # Skip validation for basic language models (they're blank fallbacks)
        if type(model).__name__ in ["English", "German", "Spanish", "Russian"]:
            # Basic models are acceptable fallbacks even without full components
            return

        required_components = {"lemmatizer", "tagger"}
        available_components = set(model.pipe_names) if hasattr(model, "pipe_names") else set()

        if not required_components.issubset(available_components):
            # Get a suggestion for a proper core model
            model_suggestions = {
                "en": "en_core_web_sm",
                "de": "de_core_news_sm",
                "es": "es_core_news_sm",
                "ru": "ru_core_news_sm",
            }
            suggested_model = model_suggestions.get(language_code, f"{language_code}_core_web_sm")

            raise RuntimeError(
                f"{language_code.upper()}: spaCy model lacks required components (lemmatizer, tagger). "
                f"Current model has: {list(available_components)}. "
                f"Install a core model with: python -m spacy download {suggested_model}"
            )

    def _load_basic_model(self, language_code: str) -> Any | None:
        """
        Load a basic language model as fallback.

        Args:
            language_code: ISO language code

        Returns:
            Basic spaCy language model or None if not available
        """
        basic_models = {
            "en": English,
            "de": German,
            "es": Spanish,
            "ru": Russian,
        }

        if language_code in basic_models:
            try:
                return basic_models[language_code]()
            except Exception:
                return None

        return None

    def _download_model(self, model_name: str, silent: bool = False) -> bool:
        """
        Attempt to download a spaCy model automatically.

        Args:
            model_name: Name of the spaCy model to download

        Returns:
            True if download succeeded, False otherwise
        """
        if model_name in self._download_attempted:
            return False  # Don't try downloading the same model twice

        self._download_attempted.add(model_name)

        if not silent:
            print(f"   Attempting to download {model_name}...")
        try:
            # Run spacy download command
            result = subprocess.run(
                [sys.executable, "-m", "spacy", "download", model_name],
                check=False,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout
            )

            if result.returncode == 0:
                if not silent:
                    print(f"  Successfully downloaded {model_name}")
                return True
            if not silent:
                print(f"  Failed to download {model_name}: {result.stderr.strip()}")
            return False

        except subprocess.TimeoutExpired:
            if not silent:
                print(f"  ⏱️  Download of {model_name} timed out")
            return False
        except Exception as e:
            if not silent:
                print(f"  Error downloading {model_name}: {e}")
            return False

    def is_model_loaded(self, language_code: str) -> bool:
        """
        Check if a model is already loaded and cached.

        Args:
            language_code: ISO language code

        Returns:
            True if model is cached, False otherwise
        """
        return language_code in self._model_cache

    def get_model_info(self, language_code: str) -> dict[str, Any]:
        """
        Get information about the loaded model.

        Args:
            language_code: ISO language code

        Returns:
            Dictionary with model information

        Raises:
            ValueError: If model is not loaded
        """
        if language_code not in self._model_cache:
            raise ValueError(f"No model loaded for language: {language_code}")

        model = self._model_cache[language_code]

        return {
            "language": language_code,
            "model_name": getattr(model.meta, "name", "unknown"),
            "model_version": getattr(model.meta, "version", "unknown"),
            "has_vectors": (model.vocab.vectors.size > 0 if hasattr(model.vocab, "vectors") else False),
            "pipeline_components": (list(model.pipe_names) if hasattr(model, "pipe_names") else []),
        }

    def clear_cache(self):
        """Clear all cached models to free memory."""
        self._model_cache.clear()


# Global model manager instance
_model_manager = NLPModelManager()


def get_nlp_model(
    language_code: str,
    model_preferences: list[str] | None = None,
    silent: bool = False,
) -> Any:
    """
    Convenience function to get an NLP model.

    Args:
        language_code: ISO language code
        model_preferences: List of preferred models to try
        silent: If True, suppress loading messages

    Returns:
        Loaded spaCy NLP model
    """
    return _model_manager.load_model(language_code, model_preferences, silent)


def clear_model_cache():
    """Clear the global NLP model cache."""
    _model_manager.clear_cache()
