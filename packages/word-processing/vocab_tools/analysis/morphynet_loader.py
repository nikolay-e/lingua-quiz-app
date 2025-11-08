from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from wordfreq import zipf_frequency

LanguageCodeType = Literal["en", "es", "de", "ru"]


@dataclass
class WordFamily:
    base_form: str
    members: set[str] = field(default_factory=set)
    derivational_relations: dict[str, list[str]] = field(default_factory=dict)
    base_frequency: float = 0.0
    cefr_level: str | None = None
    language: str = "en"

    def add_member(self, word: str, relation_type: str = "derived"):
        self.members.add(word)
        if relation_type not in self.derivational_relations:
            self.derivational_relations[relation_type] = []
        if word not in self.derivational_relations[relation_type]:
            self.derivational_relations[relation_type].append(word)

    def get_learning_sequence(self, language_code: str) -> list[str]:
        if self.base_form not in self.members:
            self.members.add(self.base_form)

        sequence = [self.base_form]
        others = sorted([w for w in self.members if w != self.base_form], key=lambda w: zipf_frequency(w, language_code), reverse=True)
        sequence.extend(others)
        return sequence

    def size(self) -> int:
        return len(self.members)


class MorphyNetLoader:
    def __init__(self, data_dir: Path | None = None):
        if data_dir is None:
            package_root = Path(__file__).parent.parent
            data_dir = package_root / "data" / "morphynet"

        self.data_dir = Path(data_dir)
        self._families: dict[str, dict[str, WordFamily]] = {}

    def load_language(self, language: LanguageCodeType) -> dict[str, WordFamily]:
        if language in self._families:
            return self._families[language]

        lang_file = self.data_dir / language / "derivations.tsv"

        if not lang_file.exists():
            print(f"⚠️  MorphyNet data not found: {lang_file}")
            print("   Download from: https://github.com/kbatsuren/MorphyNet")
            print(f"   Place derivations.tsv in: {self.data_dir / language}/")
            return {}

        families = self._parse_derivations_file(lang_file, language)
        self._families[language] = families

        print(f"Loaded {len(families)} word families for {language}")
        return families

    def _parse_derivations_file(self, file_path: Path, language: str) -> dict[str, WordFamily]:
        families = {}

        try:
            with open(file_path, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#"):
                        continue

                    parts = line.split("\t")
                    if len(parts) < 2:
                        continue

                    base_word = parts[0].lower()
                    derived_word = parts[1].lower()
                    relation_type = parts[2] if len(parts) > 2 else "derived"

                    if base_word not in families:
                        base_freq = zipf_frequency(base_word, language)
                        families[base_word] = WordFamily(base_form=base_word, base_frequency=base_freq, language=language)

                    families[base_word].add_member(base_word, "base")
                    families[base_word].add_member(derived_word, relation_type)

        except FileNotFoundError:
            print(f"File not found: {file_path}")
            return {}
        except Exception as e:
            print(f"Error parsing {file_path}: {e}")
            return {}

        return families

    def get_family(self, word: str, language: LanguageCodeType) -> WordFamily | None:
        families = self.load_language(language)
        word_lower = word.lower()

        if word_lower in families:
            return families[word_lower]

        for _base_form, family in families.items():
            if word_lower in family.members:
                return family

        return None

    def get_all_families(self, language: LanguageCodeType) -> list[WordFamily]:
        families = self.load_language(language)
        return list(families.values())

    def get_statistics(self, language: LanguageCodeType) -> dict:
        families = self.load_language(language)

        if not families:
            return {}

        total_words = sum(f.size() for f in families.values())
        avg_family_size = total_words / len(families) if families else 0

        largest = max(families.values(), key=lambda f: f.size())

        return {
            "total_families": len(families),
            "total_words": total_words,
            "average_family_size": round(avg_family_size, 2),
            "largest_family": {
                "base": largest.base_form,
                "size": largest.size(),
                "members": list(largest.members)[:10],
            },
        }


def get_morphynet_loader(data_dir: Path | None = None) -> MorphyNetLoader:
    return MorphyNetLoader(data_dir)
