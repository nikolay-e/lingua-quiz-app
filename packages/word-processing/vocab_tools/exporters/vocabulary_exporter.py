from datetime import UTC, datetime
import json
from pathlib import Path

from ..config.config_loader import get_config_loader
from ..core.vocabulary_processor import ProcessedVocabulary


class VocabularyExporter:
    def __init__(self, output_format: str = "json"):
        self.output_format = output_format
        self.config_loader = get_config_loader()

    def export(self, vocab: ProcessedVocabulary, output_path: Path | str):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        if self.output_format == "json":
            self._export_json(vocab, output_path)
        elif self.output_format == "csv":
            self._export_csv(vocab, output_path)
        elif self.output_format == "migration":
            self._export_migration_format(vocab, output_path)
        else:
            raise ValueError(f"Unsupported output format: {self.output_format}")

    def _export_json(self, vocab: ProcessedVocabulary, output_path: Path):
        language_name = self.config_loader.get_language_name(vocab.language_code)

        data = {
            "language": vocab.language_code,
            "language_name": language_name,
            "total_words": vocab.total_words,
            "filtered_count": vocab.filtered_count,
            "generated_at": datetime.now(UTC).isoformat(),
            "filtering_applied": {"removed_inflections": True, "removed_named_entities": True, "lemmatization": True},
            "words": [
                {
                    "rank": w.rank,
                    "word": w.word,
                    "lemma": w.lemma,
                    "frequency": w.frequency,
                    "pos": w.pos_tag,
                    "category": w.category,
                    "morphology": w.morphology,
                    "reason": w.reason,
                }
                for w in vocab.words
            ],
            "category_summary": {category: len(words) for category, words in vocab.categories.items()},
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _export_csv(self, vocab: ProcessedVocabulary, output_path: Path):
        with open(output_path, "w", encoding="utf-8", newline="") as f:
            for w in vocab.words:
                f.write(f"{w.word}\n")

    def _export_migration_format(self, vocab: ProcessedVocabulary, output_path: Path):
        language_name = self.config_loader.get_language_name(vocab.language_code)

        data = {
            "source_language": language_name,
            "target_language": "Target Language",
            "word_list_name": f"{language_name} Frequency List",
            "word_pairs": [
                {
                    "translation_id": 10000000 + i,
                    "source_id": 10000001 + (i * 2),
                    "target_id": 10000002 + (i * 2),
                    "source_word": w.word,
                    "target_word": "[NEEDS TRANSLATION]",
                    "source_example": "",
                    "target_example": "",
                }
                for i, w in enumerate(vocab.words)
            ],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
