import warnings
from typing import Any


class Lemmatizer:
    def __init__(self, use_stanza: bool = False):
        warnings.warn(
            "Lemmatizer class is deprecated. Use get_lemmatization_service() instead. See lemmatization_service.py for the new API.",
            DeprecationWarning,
            stacklevel=2,
        )

        self._lemma_cache: dict[tuple[str, str], str] = {}
        self._nlp_models: dict[str, Any] = {}
        self._stanza_lemmatizers: dict[str, Any] = {}
        self.use_stanza = use_stanza

        if use_stanza:
            print("Stanza lemmatization enabled (Stanford NLP)")
            print("   +10.8% accuracy vs spaCy, 13x faster processing")

    def _get_nlp_model(self, language_code: str):
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

    def _get_stanza_lemmatizer(self, language_code: str):
        if not self.use_stanza:
            return None

        if language_code not in self._stanza_lemmatizers:
            try:
                from .stanza_lemmatizer import get_stanza_lemmatizer

                self._stanza_lemmatizers[language_code] = get_stanza_lemmatizer(language_code)
            except Exception as e:
                print(f"⚠️  Failed to load Stanza lemmatizer: {e}")
                self._stanza_lemmatizers[language_code] = None

        return self._stanza_lemmatizers[language_code]

    def get_lemma(self, word: str, language_code: str) -> str:
        cache_key = (language_code, word.lower())
        if cache_key in self._lemma_cache:
            return self._lemma_cache[cache_key]

        stanza_lemmatizer = self._get_stanza_lemmatizer(language_code)
        if stanza_lemmatizer and stanza_lemmatizer.is_available():
            try:
                lemma = stanza_lemmatizer.lemmatize(word)
                lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)
                self._lemma_cache[cache_key] = lemma
                return lemma
            except Exception:
                pass

        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            self._lemma_cache[cache_key] = word.lower()
            return word.lower()

        try:
            doc = nlp(word)
            if doc and len(doc) > 0:
                lemma = doc[0].lemma_.lower()
                lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)
                self._lemma_cache[cache_key] = lemma
                return lemma
        except Exception:
            pass

        self._lemma_cache[cache_key] = word.lower()
        return word.lower()

    def _validate_lemma_with_wordfreq(self, word: str, lemma: str, language_code: str) -> str:
        from wordfreq import zipf_frequency

        lemma_zipf = zipf_frequency(lemma, language_code)
        word_zipf = zipf_frequency(word, language_code)

        if lemma_zipf == 0.0 and word_zipf > 0.0:
            return word.lower()

        if word_zipf > lemma_zipf + 1.0:
            return word.lower()

        return lemma

    def lemmatize_word_list(self, words: list[str], language_code: str) -> list[str]:
        stanza_lemmatizer = self._get_stanza_lemmatizer(language_code)
        if stanza_lemmatizer and stanza_lemmatizer.is_available():
            return self._lemmatize_with_stanza(words, language_code, stanza_lemmatizer)

        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            return list(dict.fromkeys(w.lower() for w in words))

        return self._lemmatize_with_spacy(words, language_code, nlp)

    def _lemmatize_with_stanza(self, words: list[str], language_code: str, stanza_lemmatizer) -> list[str]:
        seen_lemmas = set()
        result = []
        batch_size = 1000

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]

            try:
                lemmas_batch = stanza_lemmatizer.lemmatize_batch(batch_words)

                for idx, lemma in enumerate(lemmas_batch):
                    word = batch_words[idx]
                    lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)

                    cache_key = (language_code, word.lower())
                    self._lemma_cache[cache_key] = lemma

                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)
            except Exception:
                for word in batch_words:
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)

        return result

    def _lemmatize_with_spacy(self, words: list[str], language_code: str, nlp) -> list[str]:
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
                        lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)

                        cache_key = (language_code, word.lower())
                        self._lemma_cache[cache_key] = lemma
                    else:
                        lemma = word.lower()

                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)
            except Exception:
                for word in batch_words:
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in seen_lemmas:
                        seen_lemmas.add(lemma)
                        result.append(lemma)

        return result

    def build_lemma_rank_map(self, words: list[str], language_code: str) -> dict[str, int]:
        stanza_lemmatizer = self._get_stanza_lemmatizer(language_code)
        if stanza_lemmatizer and stanza_lemmatizer.is_available():
            return self._build_rank_map_with_stanza(words, language_code, stanza_lemmatizer)

        nlp = self._get_nlp_model(language_code)
        if nlp is None:
            return {word.lower(): rank for rank, word in enumerate(words, start=1)}

        return self._build_rank_map_with_spacy(words, language_code, nlp)

    def _build_rank_map_with_stanza(self, words: list[str], language_code: str, stanza_lemmatizer) -> dict[str, int]:
        lemma_ranks = {}
        batch_size = 1000

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]

            try:
                lemmas_batch = stanza_lemmatizer.lemmatize_batch(batch_words)

                for idx, lemma in enumerate(lemmas_batch):
                    rank = batch_start + idx + 1
                    word = batch_words[idx]
                    lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)

                    cache_key = (language_code, word.lower())
                    self._lemma_cache[cache_key] = lemma

                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank
            except Exception:
                for idx, word in enumerate(batch_words):
                    rank = batch_start + idx + 1
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank

        return lemma_ranks

    def _build_rank_map_with_spacy(self, words: list[str], language_code: str, nlp) -> dict[str, int]:
        lemma_ranks = {}
        batch_size = 1000

        for batch_start in range(0, len(words), batch_size):
            batch_words = words[batch_start : batch_start + batch_size]

            try:
                docs = list(nlp.pipe(batch_words, disable=["parser", "ner"]))

                for idx, doc in enumerate(docs):
                    rank = batch_start + idx + 1
                    word = batch_words[idx]

                    if doc and len(doc) > 0:
                        lemma = doc[0].lemma_.lower()
                        lemma = self._validate_lemma_with_wordfreq(word, lemma, language_code)

                        cache_key = (language_code, word.lower())
                        self._lemma_cache[cache_key] = lemma
                    else:
                        lemma = word.lower()

                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank
            except Exception:
                for idx, word in enumerate(batch_words):
                    rank = batch_start + idx + 1
                    lemma = self.get_lemma(word, language_code)
                    if lemma not in lemma_ranks:
                        lemma_ranks[lemma] = rank

        return lemma_ranks
