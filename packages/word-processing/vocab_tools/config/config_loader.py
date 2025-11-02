from pathlib import Path

import yaml


class ConfigLoader:
    _instance = None
    _config = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_config()
        return cls._instance

    def _load_config(self):
        config_path = Path(__file__).parent.parent.parent / "config.yaml"

        if not config_path.exists():
            raise FileNotFoundError(f"Configuration file not found at {config_path}")

        with open(config_path, encoding="utf-8") as f:
            self._config = yaml.safe_load(f)

    def get_language_config(self, language_code: str) -> dict:
        if language_code not in self._config["languages"]:
            raise ValueError(f"Unsupported language code: {language_code}")
        return self._config["languages"][language_code]

    def get_supported_languages(self) -> list[str]:
        return list(self._config["languages"].keys())

    def get_analysis_defaults(self) -> dict:
        return self._config["analysis_defaults"]

    def get_essential_vocabulary_categories(self) -> list[str]:
        return self._config["essential_vocabulary_categories"]

    def get_language_name(self, language_code: str) -> str:
        return self.get_language_config(language_code)["name"]

    def get_wordfreq_code(self, language_code: str) -> str:
        lang_config = self.get_language_config(language_code)
        return lang_config.get("wordfreq_code", language_code)

    def get_spacy_models(self, language_code: str) -> list[str]:
        return self.get_language_config(language_code)["spacy_models"]

    def get_skip_words(self, language_code: str) -> set[str]:
        return set(self.get_language_config(language_code)["skip_words"])

    def get_pos_categories(self, language_code: str) -> dict:
        return self.get_language_config(language_code)["pos_categories"]

    def get_inflection_patterns(self, language_code: str) -> dict:
        return self.get_language_config(language_code)["inflection_patterns"]


def get_config_loader() -> ConfigLoader:
    return ConfigLoader()
