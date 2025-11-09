"""
Centralized thread-safe lemmatization service.

Consolidates all lemmatization logic into a single service with:
- Thread-safe singleton pattern for model management
- Unified caching across all consumers
- Consistent fallback strategy
- Automatic model selection (Stanza → spaCy → lowercase)
"""

import threading
from typing import ClassVar, Literal

from wordfreq import zipf_frequency

from ..config.constants import LEMMATIZATION_BATCH_SIZE

LanguageCodeType = Literal["en", "es", "de", "ru"]


class LemmatizationService:
    """
    Thread-safe centralized lemmatization service.

    Manages NLP models (Stanza/spaCy) and lemma caching across all modules.
    Uses singleton pattern to ensure only one instance per language.
    """

    _instances: ClassVar[dict[str, "LemmatizationService"]] = {}
    _lock: ClassVar[threading.Lock] = threading.Lock()

    def __init__(self, language_code: LanguageCodeType):
        """
        Initialize lemmatization service for language.

        Args:
            language_code: ISO language code (en, es, de, ru)
        """
        self.language_code = language_code
        self._lemma_cache: dict[str, str] = {}
        self._nlp_model = None
        self._model_loaded = False
        self._load_lock = threading.Lock()

    @classmethod
    def get_instance(cls, language_code: LanguageCodeType) -> "LemmatizationService":
        """
        Get or create lemmatization service for language (thread-safe singleton).

        Args:
            language_code: ISO language code

        Returns:
            Shared lemmatization service instance
        """
        if language_code not in cls._instances:
            with cls._lock:
                # Double-check locking pattern
                if language_code not in cls._instances:
                    cls._instances[language_code] = cls(language_code)

        return cls._instances[language_code]

    def _load_model(self):
        """
        Lazy-load NLP model with thread safety.

        Tries Stanza first (95.5% accuracy), falls back to spaCy.
        """
        if self._model_loaded:
            return

        with self._load_lock:
            # Double-check locking
            if self._model_loaded:
                return

            # Try Stanza first (high accuracy)
            try:
                from .stanza_lemmatizer import get_stanza_lemmatizer

                stanza_lemmatizer = get_stanza_lemmatizer(self.language_code)
                if stanza_lemmatizer and stanza_lemmatizer.is_available():
                    self._nlp_model = stanza_lemmatizer
                    self._model_loaded = True
                    print(f"LemmatizationService: Loaded Stanza for {self.language_code}")
                    return
            except Exception as e:
                print(f"⚠️  LemmatizationService: Stanza unavailable for {self.language_code}: {e}")

            # Fallback to spaCy
            try:
                from ..config.config_loader import get_config_loader
                from .nlp_models import get_nlp_model

                config_loader = get_config_loader()
                model_preferences = config_loader.get_spacy_models(self.language_code)
                self._nlp_model = get_nlp_model(self.language_code, model_preferences, silent=True)
                self._model_loaded = True
                print(f"LemmatizationService: Loaded spaCy for {self.language_code} (fallback)")
            except Exception as e:
                print(f"⚠️  LemmatizationService: No NLP model available for {self.language_code}: {e}")
                self._model_loaded = True  # Mark as loaded to avoid retries

    def lemmatize(self, word: str) -> str:
        """
        Lemmatize single word with validation.

        Args:
            word: Word to lemmatize

        Returns:
            Lemma (base form) or lowercase word if lemmatization unavailable
        """
        if not word:
            return ""

        word_lower = word.lower()

        # Check cache first (thread-safe read)
        if word_lower in self._lemma_cache:
            return self._lemma_cache[word_lower]

        # Load model if not loaded
        self._load_model()

        if self._nlp_model is None:
            # No model available - return lowercase
            self._lemma_cache[word_lower] = word_lower
            return word_lower

        # Lemmatize with model
        lemma = self._lemmatize_with_model(word_lower)

        # Validate lemma with wordfreq fallback
        validated_lemma = self._validate_lemma_with_wordfreq(word_lower, lemma)

        # Cache result (thread-safe write)
        with self._lock:
            self._lemma_cache[word_lower] = validated_lemma

        return validated_lemma

    def lemmatize_with_pos(self, word: str) -> list[tuple[str, str]]:
        """
        Lemmatize word and return lemma with POS tag.

        Args:
            word: Word to lemmatize

        Returns:
            List of (lemma, POS) tuples (usually single item, but can be multiple for compound words)
        """
        if not word:
            return []

        word_lower = word.lower()

        # Load model if not loaded
        self._load_model()

        if self._nlp_model is None:
            # No model available
            return [(word_lower, "UNKNOWN")]

        # Check if this is Stanza (has lemmatize_with_pos method)
        is_stanza = hasattr(self._nlp_model, "lemmatize_with_pos")

        if is_stanza:
            try:
                return self._nlp_model.lemmatize_with_pos(word_lower)
            except Exception:
                return [(word_lower, "UNKNOWN")]
        else:
            # spaCy fallback
            try:
                doc = self._nlp_model(word_lower)
                results = []
                for token in doc:
                    lemma = token.lemma_.lower()
                    pos = token.pos_
                    validated_lemma = self._validate_lemma_with_wordfreq(word_lower, lemma)
                    results.append((validated_lemma, pos))
                return results if results else [(word_lower, "UNKNOWN")]
            except Exception:
                return [(word_lower, "UNKNOWN")]

    def lemmatize_batch(self, words: list[str]) -> list[str]:
        """
        Batch lemmatization for efficiency.

        Args:
            words: List of words to lemmatize

        Returns:
            List of lemmas
        """
        if not words:
            return []

        # Load model if not loaded
        self._load_model()

        if self._nlp_model is None:
            # No model - return lowercase
            return [w.lower() for w in words]

        # Check which words are already cached
        results = []
        uncached_indices = []
        uncached_words = []

        for i, word in enumerate(words):
            word_lower = word.lower()
            if word_lower in self._lemma_cache:
                results.append(self._lemma_cache[word_lower])
            else:
                results.append(None)  # Placeholder
                uncached_indices.append(i)
                uncached_words.append(word_lower)

        # Process uncached words in batch
        if uncached_words:
            lemmas = self._lemmatize_batch_with_model(uncached_words)

            # Validate and cache results
            for idx, lemma in zip(uncached_indices, lemmas, strict=False):
                word_lower = uncached_words[uncached_indices.index(idx)]
                validated = self._validate_lemma_with_wordfreq(word_lower, lemma)
                results[idx] = validated

                with self._lock:
                    self._lemma_cache[word_lower] = validated

        return results

    def _lemmatize_with_model(self, word: str) -> str:
        """Lemmatize single word with loaded model."""
        is_stanza = hasattr(self._nlp_model, "lemmatize")

        if is_stanza:
            try:
                return self._nlp_model.lemmatize(word).lower()
            except Exception:
                return word
        else:
            # spaCy
            try:
                doc = self._nlp_model(word)
                if doc and len(doc) > 0:
                    return doc[0].lemma_.lower()
            except Exception:
                pass
            return word

    def _lemmatize_batch_with_model(self, words: list[str]) -> list[str]:
        """Batch lemmatization with loaded model."""
        is_stanza = hasattr(self._nlp_model, "lemmatize_batch")

        if is_stanza:
            try:
                lemmas = self._nlp_model.lemmatize_batch(words)
                return [lemma.lower() for lemma in lemmas]
            except Exception:
                # Fallback to single word processing
                return [self._lemmatize_with_model(w) for w in words]
        else:
            # spaCy batch processing
            try:
                docs = list(self._nlp_model.pipe(words, disable=["parser", "ner"]))
                results = []
                for i, doc in enumerate(docs):
                    if doc and len(doc) > 0:
                        results.append(doc[0].lemma_.lower())
                    else:
                        results.append(words[i])
                return results
            except Exception:
                # Fallback to single word processing
                return [self._lemmatize_with_model(w) for w in words]

    def _validate_lemma_with_wordfreq(self, word: str, lemma: str) -> str:
        """
        Validate lemma using wordfreq corpus.

        spaCy/Stanza sometimes produce invalid lemmas (e.g., "mapo" for "mapa").
        Use wordfreq to check if lemma exists in corpus.

        Args:
            word: Original word
            lemma: Proposed lemma from model

        Returns:
            Validated lemma (or original word if lemma invalid)
        """
        lemma_zipf = zipf_frequency(lemma, self.language_code)
        word_zipf = zipf_frequency(word, self.language_code)

        # If lemma not found in corpus but word is found, use word
        if lemma_zipf == 0.0 and word_zipf > 0.0:
            return word

        # If word is significantly more frequent than lemma (> 10x), use word
        if word_zipf > lemma_zipf + 1.0:
            return word

        return lemma

    def build_lemma_rank_map(self, words: list[str]) -> dict[str, int]:
        """
        Build mapping from lemma to rank (1-based) using batch processing.

        Args:
            words: List of words in frequency order (rank 1, 2, 3, ...)

        Returns:
            Dictionary mapping lemma to its best rank (first occurrence)
        """
        lemma_ranks = {}
        batch_size = LEMMATIZATION_BATCH_SIZE

        # Load model if needed
        self._load_model()

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]
            lemmas = self.lemmatize_batch(batch_words)

            for i, lemma in enumerate(lemmas):
                rank = batch_start + i + 1
                if lemma not in lemma_ranks:
                    lemma_ranks[lemma] = rank

        return lemma_ranks

    def clear_cache(self):
        """Clear lemma cache (useful for testing)."""
        with self._lock:
            self._lemma_cache.clear()


def get_lemmatization_service(language_code: LanguageCodeType) -> LemmatizationService:
    """
    Get shared lemmatization service for language.

    This is the main entry point for all lemmatization needs.

    Args:
        language_code: ISO language code (en, es, de, ru)

    Returns:
        Singleton lemmatization service instance
    """
    return LemmatizationService.get_instance(language_code)
