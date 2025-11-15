from pathlib import Path


class ReferenceValidator:
    def __init__(self, language_code: str, reference_dir: Path | None = None):
        self.language_code = language_code
        self.reference_dir = reference_dir or self._find_reference_dir()
        self.reference_words = self._load_reference_list()

    def _find_reference_dir(self) -> Path:
        possible_paths = [
            Path.cwd() / "data" / "reference" / "cefr",
            Path.cwd().parent / "data" / "reference" / "cefr",
            Path(__file__).parent.parent.parent / "data" / "reference" / "cefr",
        ]

        for path in possible_paths:
            if path.exists():
                return path

        raise FileNotFoundError(f"Could not find reference data directory. Searched: {possible_paths}")

    def _load_reference_list(self) -> set[str]:
        possible_files = [
            self.reference_dir / f"{self.language_code}_a1_a2_cervantes.txt",
            self.reference_dir / f"{self.language_code}_a1_a2.txt",
            self.reference_dir / f"{self.language_code}_cefr.txt",
        ]

        for file_path in possible_files:
            if file_path.exists():
                return self._parse_reference_file(file_path)

        raise FileNotFoundError(
            f"No reference list found for language '{self.language_code}'. Searched: {possible_files}"
        )

    def _parse_reference_file(self, file_path: Path) -> set[str]:
        words = set()

        with open(file_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()

                if not line or line.startswith("#"):
                    continue

                word = line.lower()
                words.add(word)

        return words

    def is_in_reference(self, word: str) -> bool:
        return word.lower() in self.reference_words

    def validate_words(self, words: list[str]) -> dict[str, bool]:
        return {word: self.is_in_reference(word) for word in words}

    def filter_valid_words(self, words: list[str]) -> list[str]:
        return [word for word in words if self.is_in_reference(word)]

    def filter_invalid_words(self, words: list[str]) -> list[str]:
        return [word for word in words if not self.is_in_reference(word)]

    def get_stats(self) -> dict:
        return {
            "language": self.language_code,
            "total_words": len(self.reference_words),
            "reference_dir": str(self.reference_dir),
        }
