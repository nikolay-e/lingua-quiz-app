import json
from pathlib import Path

from .vocabulary_processor import ProcessedVocabulary, ProcessedWord


def load_frequency_list(file_path: Path | str) -> ProcessedVocabulary:
    file_path = Path(file_path)

    if not file_path.exists():
        raise FileNotFoundError(f"Frequency list not found: {file_path}")

    with open(file_path, encoding="utf-8") as f:
        data = json.load(f)

    # Validate format
    if "language" not in data or "words" not in data:
        raise ValueError(
            f"Invalid frequency list format in {file_path}. Expected JSON with 'language' and 'words' fields."
        )

    # Convert JSON words to ProcessedWord objects
    processed_words = []
    for word_data in data["words"]:
        processed_words.append(
            ProcessedWord(
                rank=word_data.get("rank", 0),
                word=word_data.get("word", ""),
                lemma=word_data.get("lemma", word_data.get("word", "")),
                frequency=word_data.get("frequency", 0.0),
                pos_tag=word_data.get("pos", ""),
                category=word_data.get("category", ""),
                morphology=word_data.get("morphology", {}),
                reason=word_data.get("reason", ""),
                metadata={},  # Empty metadata for pre-generated lists
            )
        )

    # Create ProcessedVocabulary
    vocab = ProcessedVocabulary(
        language_code=data["language"],
        words=processed_words,
        total_words=data.get("total_words", len(processed_words)),
        filtered_count=data.get("filtered_count", 0),
        categories={},  # Will be rebuilt if needed
    )

    return vocab


def find_frequency_list(language_code: str, search_paths: list[Path] | None = None) -> Path | None:
    if search_paths is None:
        search_paths = []

    default_paths = [
        Path.cwd() / "frequency_lists",
        Path.cwd().parent / "frequency_lists",
        Path.cwd() / "data" / "frequency_lists",
    ]

    all_paths = default_paths + search_paths

    filename = f"{language_code}_frequency_list.json"

    for search_dir in all_paths:
        candidate = search_dir / filename
        if candidate.exists():
            return candidate

    return None
