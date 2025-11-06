from pathlib import Path
from tempfile import TemporaryDirectory

from vocab_tools.analysis.morphynet_loader import (
    MorphyNetLoader,
    WordFamily,
    get_morphynet_loader,
)


class TestWordFamily:
    def test_initialization(self):
        family = WordFamily(base_form="run", base_frequency=5.0, language="en")
        assert family.base_form == "run"
        assert family.base_frequency == 5.0
        assert family.language == "en"
        assert len(family.members) == 0

    def test_add_member(self):
        family = WordFamily(base_form="run", language="en")
        family.add_member("runner", "derived")
        family.add_member("running", "inflection")

        assert "runner" in family.members
        assert "running" in family.members
        assert "runner" in family.derivational_relations["derived"]
        assert "running" in family.derivational_relations["inflection"]

    def test_get_learning_sequence(self):
        family = WordFamily(base_form="run", language="en")
        family.add_member("run", "base")
        family.add_member("runner", "derived")
        family.add_member("running", "inflection")

        sequence = family.get_learning_sequence("en")

        assert sequence[0] == "run"
        assert len(sequence) == 3
        assert all(word in family.members for word in sequence)

    def test_size(self):
        family = WordFamily(base_form="test", language="en")
        family.add_member("test", "base")
        family.add_member("testing", "inflection")
        family.add_member("tested", "inflection")

        assert family.size() == 3


class TestMorphyNetLoader:
    def test_initialization_default_path(self):
        loader = MorphyNetLoader()
        assert loader.data_dir.name == "morphynet"

    def test_initialization_custom_path(self):
        with TemporaryDirectory() as tmpdir:
            loader = MorphyNetLoader(Path(tmpdir))
            assert loader.data_dir == Path(tmpdir)

    def test_load_missing_data(self):
        with TemporaryDirectory() as tmpdir:
            loader = MorphyNetLoader(Path(tmpdir))
            families = loader.load_language("en")
            assert families == {}

    def test_parse_derivations_file(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = """run\trunner\tderived
run\trunning\tinflection
test\ttesting\tinflection
test\ttested\tpast
"""
            tsv_file = en_dir / "derivations.tsv"
            tsv_file.write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            families = loader.load_language("en")

            assert len(families) == 2
            assert "run" in families
            assert "test" in families

            run_family = families["run"]
            assert "runner" in run_family.members
            assert "running" in run_family.members

            test_family = families["test"]
            assert "testing" in test_family.members
            assert "tested" in test_family.members

    def test_get_family_by_base_word(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = "run\trunner\tderived\n"
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            family = loader.get_family("run", "en")

            assert family is not None
            assert family.base_form == "run"

    def test_get_family_by_derived_word(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = "run\trunner\tderived\n"
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            family = loader.get_family("runner", "en")

            assert family is not None
            assert family.base_form == "run"
            assert "runner" in family.members

    def test_get_family_not_found(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = "run\trunner\tderived\n"
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            family = loader.get_family("nonexistent", "en")

            assert family is None

    def test_get_all_families(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = """run\trunner\tderived
test\ttesting\tinflection
"""
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            families = loader.get_all_families("en")

            assert len(families) == 2
            base_forms = [f.base_form for f in families]
            assert "run" in base_forms
            assert "test" in base_forms

    def test_get_statistics(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = """run\trunner\tderived
run\trunning\tinflection
test\ttesting\tinflection
"""
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            stats = loader.get_statistics("en")

            assert stats["total_families"] == 2
            assert stats["total_words"] > 0
            assert "average_family_size" in stats
            assert "largest_family" in stats

    def test_get_statistics_empty(self):
        with TemporaryDirectory() as tmpdir:
            loader = MorphyNetLoader(Path(tmpdir))
            stats = loader.get_statistics("en")
            assert stats == {}

    def test_factory_function(self):
        loader = get_morphynet_loader()
        assert isinstance(loader, MorphyNetLoader)

    def test_multiple_languages(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)

            for lang in ["en", "de", "es"]:
                lang_dir = data_dir / lang
                lang_dir.mkdir()
                tsv_content = "test\ttesting\tinflection\n"
                (lang_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)

            en_families = loader.load_language("en")
            de_families = loader.load_language("de")
            es_families = loader.load_language("es")

            assert len(en_families) == 1
            assert len(de_families) == 1
            assert len(es_families) == 1

    def test_caching(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = "run\trunner\tderived\n"
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)

            families1 = loader.load_language("en")
            families2 = loader.load_language("en")

            assert families1 is families2

    def test_skip_comments_and_empty_lines(self):
        with TemporaryDirectory() as tmpdir:
            data_dir = Path(tmpdir)
            en_dir = data_dir / "en"
            en_dir.mkdir()

            tsv_content = """# This is a comment
run\trunner\tderived

# Another comment
test\ttesting\tinflection
"""
            (en_dir / "derivations.tsv").write_text(tsv_content)

            loader = MorphyNetLoader(data_dir)
            families = loader.load_language("en")

            assert len(families) == 2
