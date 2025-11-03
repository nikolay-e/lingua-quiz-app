"""Lemmatization utilities for word normalization."""

from typing import Any


class Lemmatizer:
    """Handles word lemmatization with caching."""

    def __init__(self):
        self._lemma_cache: dict[tuple[str, str], str] = {}
        self._nlp_models: dict[str, Any] = {}

    def _get_nlp_model(self, language_code: str):
        """
        Get spaCy model for language, caching it.

        Args:
            language_code: ISO language code

        Returns:
            spaCy model or None if not available
        """
        if language_code not in self._nlp_models:
            try:
                from ..config.config_loader import get_config_loader
                from .nlp_models import get_nlp_model

                config_loader = get_config_loader()
                model_preferences = config_loader.get_spacy_models(language_code)
                self._nlp_models[language_code] = get_nlp_model(language_code, model_preferences, silent=True)
            except Exception:
                self._nlp_models[language_code] = None
        return self._nlp_models[language_code]

    def get_lemma(self, word: str, language_code: str) -> str:
        """
        Get lemma (base form) of a word.

        Args:
            word: Word to lemmatize
            language_code: ISO language code

        Returns:
            Lemma or original word if lemmatization fails
        """
        cache_key = (language_code, word.lower())
        if cache_key in self._lemma_cache:
            return self._lemma_cache[cache_key]

        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            self._lemma_cache[cache_key] = word.lower()
            return word.lower()

        try:
            doc = nlp(word)
            if doc and len(doc) > 0:
                lemma = doc[0].lemma_.lower()
                self._lemma_cache[cache_key] = lemma
                return lemma
        except Exception:
            pass

        self._lemma_cache[cache_key] = word.lower()
        return word.lower()

    def lemmatize_word_list(self, words: list[str], language_code: str) -> list[str]:
        """
        Lemmatize a list of words and deduplicate by lemma using batch processing.

        Args:
            words: List of words in order
            language_code: ISO language code

        Returns:
            List of deduplicated lemmas (first occurrence kept)
        """
        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            return list(dict.fromkeys(w.lower() for w in words))

        seen_lemmas = set()
        result = []
        batch_size = 1000

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]

            try:
                docs = list(nlp.pipe(batch_words, disable=["parser", "ner"]))

                for idx, doc in enumerate(docs):
                    word = batch_words[idx]

                    if doc and len(doc) > 0:
                        lemma = doc[0].lemma_.lower()
                        cache_key = (language_code, word.lower())
                        self._lemma_cache[cache_key] = lemma
                    else:
                        lemma = word.lower()

                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)
            except Exception:
                # Fallback to individual processing
                for word in batch_words:
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)

        return result

    def build_lemma_rank_map(self, words: list[str], language_code: str) -> dict[str, int]:
        """
        Build mapping from lemma to rank (1-based) using batch processing.

        Args:
            words: List of words in frequency order
            language_code: ISO language code

        Returns:
            Dictionary mapping lemma to its rank (first occurrence)
        """
        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            return {word.lower(): rank for rank, word in enumerate(words, start=1)}

        lemma_ranks = {}
        batch_size = 1000

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]

            # Process batch with spaCy (much faster than one-by-one)
            try:
                docs = list(nlp.pipe(batch_words, disable=["parser", "ner"]))

                for idx, doc in enumerate(docs):
                    rank = batch_start + idx + 1
                    word = batch_words[idx]

                    if doc and len(doc) > 0:
                        lemma = doc[0].lemma_.lower()
                        cache_key = (language_code, word.lower())
                        self._lemma_cache[cache_key] = lemma
                    else:
                        lemma = word.lower()

                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank
            except Exception:
                # Fallback to individual processing for this batch
                for idx, word in enumerate(batch_words):
                    rank = batch_start + idx + 1
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank

        return lemma_ranks
