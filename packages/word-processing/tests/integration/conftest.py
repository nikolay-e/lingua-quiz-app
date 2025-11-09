from pathlib import Path

import pytest


@pytest.fixture(scope="session")
def spacy_en_model():
    import spacy

    try:
        return spacy.load("en_core_web_sm")
    except OSError:
        pytest.skip("English spaCy model not installed")


@pytest.fixture(scope="session")
def spacy_de_model():
    import spacy

    try:
        return spacy.load("de_core_news_sm")
    except OSError:
        pytest.skip("German spaCy model not installed")


@pytest.fixture(scope="session")
def spacy_es_model():
    import spacy

    try:
        return spacy.load("es_core_news_sm")
    except OSError:
        pytest.skip("Spanish spaCy model not installed")


@pytest.fixture(scope="session")
def spacy_ru_model():
    import spacy

    try:
        return spacy.load("ru_core_news_sm")
    except OSError:
        pytest.skip("Russian spaCy model not installed")


@pytest.fixture(scope="session")
def sample_english_text():
    return [
        "The cat sat on the mat.",
        "I love programming in Python.",
        "Machine learning is fascinating.",
        "Natural language processing helps computers understand text.",
        "The quick brown fox jumps over the lazy dog.",
    ]


@pytest.fixture(scope="session")
def sample_german_text():
    return [
        "Die Katze sitzt auf der Matte.",
        "Ich liebe Programmierung in Python.",
        "Maschinelles Lernen ist faszinierend.",
        "Natürliche Sprachverarbeitung hilft Computern, Text zu verstehen.",
        "Der schnelle braune Fuchs springt über den faulen Hund.",
    ]


@pytest.fixture(scope="session")
def sample_spanish_text():
    return [
        "El gato se sentó en la alfombra.",
        "Me encanta programar en Python.",
        "El aprendizaje automático es fascinante.",
        "El procesamiento del lenguaje natural ayuda a las computadoras a entender el texto.",
        "El rápido zorro marrón salta sobre el perro perezoso.",
    ]


@pytest.fixture(scope="session")
def sample_russian_text():
    return [
        "Кошка сидела на коврике.",
        "Я люблю программирование на Python.",
        "Машинное обучение увлекательно.",
        "Обработка естественного языка помогает компьютерам понимать текст.",
        "Быстрая коричневая лиса прыгает через ленивую собаку.",
    ]


@pytest.fixture(scope="session")
def sample_words_english():
    return ["running", "runs", "ran", "runner", "cats", "walking", "walked"]


@pytest.fixture(scope="session")
def sample_words_german():
    return ["laufen", "läuft", "lief", "Läufer", "Katzen", "gehen", "ging"]


@pytest.fixture(scope="session")
def sample_words_spanish():
    return ["corriendo", "corre", "corrió", "corredor", "gatos", "caminando", "caminó"]


@pytest.fixture(scope="session")
def sample_words_russian():
    return ["бегать", "бежит", "бежал", "бегун", "кошки", "ходить", "шёл"]


@pytest.fixture(scope="session")
def word_processing_root():
    """Root directory of the word-processing package."""
    return Path(__file__).parent.parent.parent


@pytest.fixture(scope="session")
def lingua_quiz_root(word_processing_root):
    """Root directory of the lingua-quiz workspace."""
    return word_processing_root.parent.parent


@pytest.fixture(scope="session")
def backend_migrations_dir(lingua_quiz_root):
    """Directory containing backend migration vocabulary files."""
    migrations_path = lingua_quiz_root / "packages" / "backend" / "migrations" / "data" / "vocabulary"
    if not migrations_path.exists():
        pytest.skip(f"Backend migrations directory not found: {migrations_path}")
    return migrations_path


@pytest.fixture(scope="session")
def spanish_a1_migration_file(backend_migrations_dir):
    """Path to Spanish A1 migration file."""
    file_path = backend_migrations_dir / "spanish-russian-a1.json"
    if not file_path.exists():
        pytest.skip(f"Spanish A1 migration file not found: {file_path}")
    return file_path


@pytest.fixture(scope="session")
def spanish_a0_migration_file(backend_migrations_dir):
    """Path to Spanish A0 migration file."""
    file_path = backend_migrations_dir / "spanish-russian-a0.json"
    if not file_path.exists():
        pytest.skip(f"Spanish A0 migration file not found: {file_path}")
    return file_path


@pytest.fixture(scope="session")
def spanish_a2_migration_file(backend_migrations_dir):
    """Path to Spanish A2 migration file."""
    file_path = backend_migrations_dir / "spanish-russian-a2.json"
    if not file_path.exists():
        pytest.skip(f"Spanish A2 migration file not found: {file_path}")
    return file_path


@pytest.fixture(scope="session")
def stanza_es_lemmatizer():
    """Stanza Spanish lemmatizer (session-scoped for performance)."""
    from vocab_tools.core.stanza_lemmatizer import get_stanza_lemmatizer

    lemmatizer = get_stanza_lemmatizer("es")
    if not lemmatizer.is_available():
        pytest.skip("Stanza not available for Spanish")
    return lemmatizer


@pytest.fixture(scope="session")
def stanza_en_lemmatizer():
    """Stanza English lemmatizer (session-scoped for performance)."""
    from vocab_tools.core.stanza_lemmatizer import get_stanza_lemmatizer

    lemmatizer = get_stanza_lemmatizer("en")
    if not lemmatizer.is_available():
        pytest.skip("Stanza not available for English")
    return lemmatizer


@pytest.fixture(scope="session")
def stanza_de_lemmatizer():
    """Stanza German lemmatizer (session-scoped for performance)."""
    from vocab_tools.core.stanza_lemmatizer import get_stanza_lemmatizer

    lemmatizer = get_stanza_lemmatizer("de")
    if not lemmatizer.is_available():
        pytest.skip("Stanza not available for German")
    return lemmatizer


@pytest.fixture(scope="session")
def stanza_ru_lemmatizer():
    """Stanza Russian lemmatizer (session-scoped for performance)."""
    from vocab_tools.core.stanza_lemmatizer import get_stanza_lemmatizer

    lemmatizer = get_stanza_lemmatizer("ru")
    if not lemmatizer.is_available():
        pytest.skip("Stanza not available for Russian")
    return lemmatizer


@pytest.fixture(scope="session")
def spanish_a1_analyzer(spanish_a1_migration_file):
    """MigrationAnalyzer for Spanish (session-scoped for performance)."""
    from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

    return MigrationAnalyzer("es", spanish_a1_migration_file)


@pytest.fixture(scope="session")
def spanish_a2_analyzer(spanish_a2_migration_file):
    """A2Analyzer for Spanish (session-scoped for performance)."""
    from vocab_tools.analysis.migration_analyzer import MigrationAnalyzer

    return MigrationAnalyzer("es", spanish_a2_migration_file)


@pytest.fixture(scope="session")
def spanish_a1_analysis_result(spanish_a1_analyzer):
    """Pre-computed A1 analysis result for Spanish (session-scoped for performance).

    This fixture computes analyzer.analyze(top_n=1500) ONCE per session,
    saving 2-5 seconds per test that needs analysis results.
    """
    return spanish_a1_analyzer.analyze(top_n=1500)


@pytest.fixture
def test_migration_file_with_rare_words(tmp_path):
    """Create a temporary migration file with rare words for testing replacement.

    This fixture creates a migration file with:
    - Common words (rank < 1000)
    - Rare words (rank > 10000) that should be replaced
    - Missing critical words (lo, un, se, quiero) not included

    Returns:
        Path to temporary migration file
    """
    import json

    migration_data = {
        "source_language": "ES",
        "target_language": "RU",
        "level": "A1",
        "word_pairs": [
            # Common words (rank < 1000) - keep these
            {
                "source_word": "casa",
                "target_word": "дом",
                "example_source": "Mi casa es grande",
                "example_target": "Мой дом большой",
            },
            {
                "source_word": "estar",
                "target_word": "быть",
                "example_source": "Estoy aquí",
                "example_target": "Я здесь",
            },
            {
                "source_word": "tener",
                "target_word": "иметь",
                "example_source": "Tengo un perro",
                "example_target": "У меня есть собака",
            },
            # Rare words (rank > 10000) - should be removed
            {
                "source_word": "rareword1",
                "target_word": "редкое1",
                "example_source": "",
                "example_target": "",
            },
            {
                "source_word": "rareword2",
                "target_word": "редкое2",
                "example_source": "",
                "example_target": "",
            },
            # More common words
            {
                "source_word": "libro",
                "target_word": "книга",
                "example_source": "Leo un libro",
                "example_target": "Я читаю книгу",
            },
            {
                "source_word": "mesa",
                "target_word": "стол",
                "example_source": "La mesa es nueva",
                "example_target": "Стол новый",
            },
            # Additional rare word for testing low_priority (rank 8000-10000)
            {
                "source_word": "lowpriority1",
                "target_word": "низкий1",
                "example_source": "",
                "example_target": "",
            },
        ],
    }

    migration_file = tmp_path / "test-spanish-russian-a1.json"
    with open(migration_file, "w", encoding="utf-8") as f:
        json.dump(migration_data, f, ensure_ascii=False, indent=2)

    return migration_file
