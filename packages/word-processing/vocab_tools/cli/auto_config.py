import os
from pathlib import Path

LANGUAGE_ALIASES = {
    "es": "es",
    "spanish": "es",
    "español": "es",
    "de": "de",
    "german": "de",
    "deutsch": "de",
    "en": "en",
    "english": "en",
    "ru": "ru",
    "russian": "ru",
    "русский": "ru",
}

LEVEL_ALIASES = {
    "a0": "A0",
    "a1": "A1",
    "a2": "A2",
    "b1": "B1",
    "b2": "B2",
    "c1": "C1",
    "c2": "C2",
}

MIGRATION_FILE_PATTERNS = [
    "v3_{language}_{level}.json",
    "{language}-russian-{level}.json",
    "{language}_{level}.json",
]

SMART_OUTPUT_DIRS = {
    "reports": Path("/tmp"),
    "generate": Path("./frequency_lists"),
}


def find_git_root(start_path: Path) -> Path | None:
    current = start_path.resolve()
    while current != current.parent:
        if (current / ".git").exists():
            return current
        current = current.parent
    return None


def auto_detect_migrations_dir() -> Path | None:
    if "MIGRATIONS_DIR" in os.environ:
        migrations_dir = Path(os.environ["MIGRATIONS_DIR"])
        if migrations_dir.exists() and migrations_dir.is_dir():
            json_files = list(migrations_dir.glob("*.json"))
            if json_files:
                return migrations_dir

    current = Path.cwd()
    relative_candidates = [
        current / "../backend/src/migrations/data",
        current / "../backend/migrations/data/vocabulary",
        current / "../../backend/migrations/data/vocabulary",
        current / "../../../backend/migrations/data/vocabulary",
        current / "migrations/data",
        current / "data/migrations",
    ]

    for candidate in relative_candidates:
        resolved = candidate.resolve()
        if resolved.exists() and resolved.is_dir():
            json_files = list(resolved.glob("*.json"))
            if json_files:
                return resolved

    git_root = find_git_root(current)
    if git_root:
        git_candidates = [
            git_root / "packages/backend/migrations/data/vocabulary",
            git_root / "packages/backend/src/migrations/data",
            git_root / "backend/migrations/data/vocabulary",
        ]

        for candidate in git_candidates:
            if candidate.exists() and candidate.is_dir():
                json_files = list(candidate.glob("*.json"))
                if json_files:
                    return candidate

    return None


def resolve_language_alias(alias: str) -> tuple[str, str]:
    alias_lower = alias.lower().strip()

    parts = alias_lower.replace("_", "-").split("-")

    if len(parts) == 1:
        lang_part = parts[0]
        level_part = None
    elif len(parts) == 2:
        lang_part, level_part = parts
    else:
        raise ValueError(f"Invalid language-level alias: {alias}")

    lang_code = LANGUAGE_ALIASES.get(lang_part)
    if not lang_code:
        raise ValueError(f"Unknown language: {lang_part}")

    if level_part:
        level = LEVEL_ALIASES.get(level_part)
        if not level:
            raise ValueError(f"Unknown CEFR level: {level_part}")
    else:
        level = "A1"

    return lang_code, level


def build_migration_path(lang: str, level: str, migrations_dir: Path | None = None) -> Path:
    if migrations_dir is None:
        migrations_dir = auto_detect_migrations_dir()
        if migrations_dir is None:
            raise FileNotFoundError("Could not auto-detect migrations directory")

    level_lower = level.lower()

    lang_full_names = {
        "es": "spanish",
        "de": "german",
        "en": "english",
        "ru": "russian",
    }

    lang_variants = [lang]
    if lang in lang_full_names:
        lang_variants.append(lang_full_names[lang])

    for lang_variant in lang_variants:
        for pattern in MIGRATION_FILE_PATTERNS:
            filename = pattern.format(language=lang_variant, level=level_lower)
            file_path = migrations_dir / filename
            if file_path.exists():
                return file_path

    raise FileNotFoundError(
        f"Could not find migration file for {lang.upper()} {level} in {migrations_dir}. Tried patterns: {', '.join(MIGRATION_FILE_PATTERNS)}"
    )


def get_smart_top_n(command: str, level: str | None = None, language: str | None = None) -> int:
    from vocab_tools.config.config_loader import get_config_loader

    config_loader = get_config_loader()

    if level is None:
        level = "a1"

    cumulative_total = config_loader.get_cumulative_total(level)

    if command == "analyze":
        return cumulative_total
    if command == "generate":
        multiplier = config_loader.get_raw_frequency_multiplier(language) if language else 2.5
        return int(cumulative_total * multiplier)
    if command == "gap_analysis":
        return cumulative_total
    return 1500


def get_smart_output_dir(purpose: str) -> Path:
    return SMART_OUTPUT_DIRS.get(purpose, Path("/tmp"))


def resolve_full_config(alias: str | None = None) -> dict:
    if alias:
        lang_code, level = resolve_language_alias(alias)
    else:
        lang_code = None
        level = None

    migrations_dir = auto_detect_migrations_dir()

    config = {
        "language": lang_code,
        "level": level,
        "migrations_dir": migrations_dir,
        "migration_file": None,
        "top_n_analyze": get_smart_top_n("analyze", level=level, language=lang_code),
        "top_n_generate": get_smart_top_n("generate", level=level, language=lang_code),
        "output_dir_reports": get_smart_output_dir("reports"),
        "output_dir_generate": get_smart_output_dir("generate"),
    }

    if lang_code and level and migrations_dir:
        try:
            config["migration_file"] = build_migration_path(lang_code, level, migrations_dir)
        except FileNotFoundError:
            pass

    return config
