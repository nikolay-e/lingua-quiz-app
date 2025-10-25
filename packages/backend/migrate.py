#!/usr/bin/env python3
"""
LinguaQuiz Migration Runner with Pydantic Validation
Runs all SQL files in migrations directory in order with proper validation
"""

import json
import os
from pathlib import Path
import sys

import psycopg2
from pydantic import BaseModel, Field, field_validator


# =================================================================
# Pydantic Models for Configuration Validation
# =================================================================
class DatabaseConfig(BaseModel):
    """Database connection configuration with validation"""

    host: str = Field(default="localhost", description="Database host")
    port: int = Field(default=5432, ge=1, le=65535, description="Database port")
    name: str = Field(default="linguaquiz_db", min_length=1, description="Database name")
    user: str = Field(default="linguaquiz_user", min_length=1, description="Database user")
    password: str = Field(default="", description="Database password")

    @field_validator("port")
    @classmethod
    def validate_port(cls, v):
        if not (1 <= v <= 65535):
            raise ValueError("Port must be between 1 and 65535")
        return v


class MigrationConfig(BaseModel):
    """Migration runner configuration with validation"""

    migrations_dir: Path = Field(default=Path("./migrations"), description="Migrations directory path")
    auto_confirm: bool = Field(default=False, description="Skip confirmation prompts")

    @field_validator("migrations_dir")
    @classmethod
    def validate_migrations_dir(cls, v):
        if not isinstance(v, Path):
            v = Path(v)
        return v


class MigrationFile(BaseModel):
    """Migration file metadata with validation"""

    filename: str = Field(..., min_length=1, description="Migration filename")
    filepath: Path = Field(..., description="Full path to migration file")
    content: str = Field(..., min_length=1, description="SQL content")

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, v):
        if not v.endswith(".sql"):
            raise ValueError("Migration files must have .sql extension")
        return v

    @field_validator("filepath")
    @classmethod
    def validate_filepath(cls, v):
        if not isinstance(v, Path):
            v = Path(v)
        if not v.exists():
            raise ValueError(f"Migration file does not exist: {v}")
        return v


# =================================================================
# Configuration Loading with Validation
# =================================================================
def load_config() -> tuple[DatabaseConfig, MigrationConfig]:
    """Load and validate configuration from environment variables"""
    try:
        db_config = DatabaseConfig(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            name=os.getenv("POSTGRES_DB", "linguaquiz_db"),
            user=os.getenv("POSTGRES_USER", "linguaquiz_user"),
            password=os.getenv("POSTGRES_PASSWORD", ""),
        )

        # Auto-confirm in CI/CD environments
        auto_confirm = os.getenv("CI") == "true" or os.getenv("KUBERNETES_SERVICE_HOST") is not None or os.getenv("DOCKER_ENVIRONMENT") == "true"

        migration_config = MigrationConfig(
            migrations_dir=Path(os.getenv("MIGRATIONS_DIR", "./migrations")),
            auto_confirm=auto_confirm,
        )

        return db_config, migration_config

    except Exception as e:
        print(f"{RED}✗ Configuration validation failed: {e}{RESET}")
        sys.exit(1)


# Colors for output
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"


def get_connection(db_config: DatabaseConfig):
    """Get database connection using validated configuration"""
    return psycopg2.connect(
        host=db_config.host,
        port=db_config.port,
        database=db_config.name,
        user=db_config.user,
        password=db_config.password,
    )


def get_migration_files(migration_config: MigrationConfig) -> list[MigrationFile]:
    """Get validated list of migration files from schema and data directories"""
    if not migration_config.migrations_dir.exists():
        print(f"{RED}Migration directory not found: {migration_config.migrations_dir}{RESET}")
        sys.exit(1)

    files = []

    # Load schema migrations first (001-010)
    schema_dir = migration_config.migrations_dir / "schema"
    if schema_dir.exists():
        for filepath in sorted(schema_dir.glob("*.sql")):
            try:
                content = filepath.read_text(encoding="utf-8")
                migration_file = MigrationFile(filename=filepath.name, filepath=filepath, content=content)
                files.append(migration_file)
            except Exception as e:
                print(f"{RED}Error reading schema migration file {filepath}: {e}{RESET}")
                sys.exit(1)

    # Load data migrations second (901+)
    data_dir = migration_config.migrations_dir / "data"
    if data_dir.exists():
        for filepath in sorted(data_dir.glob("*.sql")):
            try:
                content = filepath.read_text(encoding="utf-8")
                migration_file = MigrationFile(filename=filepath.name, filepath=filepath, content=content)
                files.append(migration_file)
            except Exception as e:
                print(f"{RED}Error reading data migration file {filepath}: {e}{RESET}")
                sys.exit(1)

    # Fallback: load any remaining files from root migrations directory
    for filepath in migration_config.migrations_dir.glob("*.sql"):
        # Skip the old schema migrations table file
        if filepath.name == "000_schema_migrations_table.sql":
            continue

        try:
            content = filepath.read_text(encoding="utf-8")
            migration_file = MigrationFile(filename=filepath.name, filepath=filepath, content=content)
            files.append(migration_file)
        except Exception as e:
            print(f"{RED}Error reading migration file {filepath}: {e}{RESET}")
            sys.exit(1)

    # Sort by numeric prefix to ensure proper order
    return sorted(files, key=lambda x: int(x.filename.split("_")[0]))


def load_json_vocabulary_data(json_file_path: Path) -> dict:
    """Load vocabulary data from JSON file"""
    try:
        with open(json_file_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"{RED}Error loading JSON file {json_file_path}: {e}{RESET}")
        return None


def run_migration(conn, migration_file: MigrationFile) -> bool:
    """Run a single validated migration with JSON support"""
    try:
        # Check if this migration requires JSON data loading
        json_file_pattern = "migrations/data/vocabulary/"
        requires_json = json_file_pattern in migration_file.content

        if requires_json:
            # Extract JSON file path from migration content
            lines = migration_file.content.split("\n")
            json_file_line = next((line for line in lines if json_file_pattern in line), None)

            if json_file_line:
                # Extract JSON filename from the comment
                json_filename = json_file_line.split(json_file_pattern)[1].strip("\"';")
                json_file_path = migration_file.filepath.parent / "vocabulary" / json_filename

                print(f"{YELLOW}Loading JSON data from: {json_file_path}{RESET}")

                # Load JSON data
                vocab_data = load_json_vocabulary_data(json_file_path)
                if not vocab_data:
                    return False

                # Process each word pair using the existing database function
                with conn.cursor() as cur:
                    source_lang = vocab_data["source_language"]
                    target_lang = vocab_data["target_language"]
                    word_list = vocab_data["word_list_name"]

                    print(f"{YELLOW}Processing {len(vocab_data['word_pairs'])} word pairs...{RESET}")

                    for word_pair in vocab_data["word_pairs"]:
                        cur.execute(
                            """
                            SELECT insert_word_pair_and_add_to_list(
                                p_translation_id := %s,
                                p_source_word_id := %s,
                                p_target_word_id := %s,
                                p_source_word := %s,
                                p_target_word := %s,
                                p_source_language_name := %s,
                                p_target_language_name := %s,
                                p_word_list_name := %s,
                                p_source_word_usage_example := %s,
                                p_target_word_usage_example := %s
                            )
                        """,
                            (
                                word_pair["translation_id"],
                                word_pair["source_id"],
                                word_pair["target_id"],
                                word_pair["source_word"],
                                word_pair["target_word"],
                                source_lang,
                                target_lang,
                                word_list,
                                word_pair["source_example"],
                                word_pair["target_example"],
                            ),
                        )

                    conn.commit()
                    print(f"{GREEN}Successfully loaded {len(vocab_data['word_pairs'])} word pairs{RESET}")
            else:
                # Run as regular migration if no JSON file found
                with conn.cursor() as cur:
                    cur.execute(migration_file.content)
                    conn.commit()
        else:
            # Run regular SQL migration
            with conn.cursor() as cur:
                cur.execute(migration_file.content)
                conn.commit()

        return True
    except Exception as e:
        conn.rollback()
        print(f"{RED}Error in {migration_file.filename}: {e}{RESET}")
        return False


def analyze_vocabulary_ranges(
    migration_config: MigrationConfig,
) -> dict[str, list[int]]:
    """
    Analyze vocabulary JSON files to determine valid translation_id ranges.

    Returns:
        Dictionary mapping vocabulary files to lists of valid translation_ids
    """
    vocab_ranges = {}
    vocab_dir = migration_config.migrations_dir / "data" / "vocabulary"

    if not vocab_dir.exists():
        return vocab_ranges

    for json_file in vocab_dir.glob("*.json"):
        try:
            with open(json_file, encoding="utf-8") as f:
                data = json.load(f)

            if "word_pairs" in data:
                translation_ids = [pair["translation_id"] for pair in data["word_pairs"]]
                vocab_ranges[json_file.name] = sorted(translation_ids)
                print(f"  {json_file.name}: {len(translation_ids)} valid IDs ({min(translation_ids)}-{max(translation_ids)})")
        except Exception as e:
            print(f"{RED}Warning: Could not analyze {json_file.name}: {e}{RESET}")

    return vocab_ranges


def cleanup_inconsistent_vocabulary_data(conn, migration_config: MigrationConfig) -> int:
    """
    Clean up vocabulary data that doesn't match the current JSON files.

    This removes any translations, words, and related data that fall outside
    the valid translation_id ranges defined in the vocabulary JSON files.

    Returns:
        Number of inconsistent entries removed
    """
    print("  Analyzing vocabulary file ranges...")
    vocab_ranges = analyze_vocabulary_ranges(migration_config)

    if not vocab_ranges:
        print("  No vocabulary files found for cleanup")
        return 0

    # Collect all valid translation IDs
    all_valid_ids = set()
    for translation_ids in vocab_ranges.values():
        all_valid_ids.update(translation_ids)

    print(f"  Found {len(all_valid_ids)} valid translation IDs across all vocabulary files")

    cleanup_count = 0

    try:
        with conn.cursor() as cur:
            # Find translations that are not in our valid set
            cur.execute(
                """
                SELECT id FROM translations
                WHERE id >= 3000000  -- Only check vocabulary data (not system data)
                AND id NOT IN %s
            """,
                (tuple(all_valid_ids),) if all_valid_ids else ((),),
            )

            invalid_translation_ids = [row[0] for row in cur.fetchall()]

            if invalid_translation_ids:
                print(f"  Found {len(invalid_translation_ids)} invalid translation entries to remove")

                # Remove invalid entries using the existing cleanup function
                for translation_id in invalid_translation_ids:
                    cur.execute(
                        """
                        SELECT remove_word_pair_and_list_entry(%s)
                    """,
                        (translation_id,),
                    )
                    cleanup_count += 1

                conn.commit()
                print(f"  Removed {cleanup_count} inconsistent vocabulary entries")
            else:
                print("  All translation entries are consistent with vocabulary files")

    except Exception as e:
        conn.rollback()
        print(f"{RED}Error during cleanup: {e}{RESET}")
        return 0

    return cleanup_count


def main():
    """Main migration runner with Pydantic validation"""
    print(f"{GREEN}LinguaQuiz Migration Runner with Pydantic Validation{RESET}")

    # Load and validate configuration
    db_config, migration_config = load_config()

    print(f"Database: {db_config.user}@{db_config.host}:{db_config.port}/{db_config.name}")
    print(f"Migrations directory: {migration_config.migrations_dir}")
    print(f"Auto-confirm: {migration_config.auto_confirm}\n")

    # Connect to database
    try:
        conn = get_connection(db_config)
        print(f"{GREEN}✓ Connected to database{RESET}")
    except Exception as e:
        print(f"{RED}✗ Failed to connect to database: {e}{RESET}")
        sys.exit(1)

    try:
        # Get and validate migration files
        migration_files = get_migration_files(migration_config)
        print(f"Found {len(migration_files)} migration files\n")

        if not migration_files:
            print(f"{GREEN}✓ No migrations to run{RESET}")
            return

        # Ask for confirmation (skip if auto-confirm is enabled)
        if not migration_config.auto_confirm:
            print(f"{YELLOW}Will run the following migrations:{RESET}")
            for migration_file in migration_files:
                print(f"  - {migration_file.filename}")
            if input("\nContinue? (y/N): ").lower() != "y":
                print("Aborted.")
                return

        # Run all migrations
        print()
        success_count = 0
        for migration_file in migration_files:
            print(f"Running {migration_file.filename}...", end=" ", flush=True)

            if run_migration(conn, migration_file):
                print(f"{GREEN}✓{RESET}")
                success_count += 1
            else:
                print(f"{RED}✗ MIGRATION FAILED. ABORTING.{RESET}")
                sys.exit(1)

        print(f"\n{GREEN}✓ Completed: {success_count}/{len(migration_files)} migrations successful{RESET}")

        # Note: Vocabulary data cleanup is available via cleanup_inconsistent_vocabulary_data()
        # but is not run automatically to prevent accidental data loss.
        # Run it manually with --cleanup flag if needed.

    finally:
        conn.close()


if __name__ == "__main__":
    main()
