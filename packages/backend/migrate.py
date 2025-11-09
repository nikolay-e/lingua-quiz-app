#!/usr/bin/env python3

import json
import os
from pathlib import Path
import sys

import psycopg2
from psycopg2.extras import Json
from pydantic import BaseModel, Field, field_validator


class DatabaseConfig(BaseModel):
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
    migrations_dir: Path = Field(default=Path("./migrations"), description="Migrations directory path")
    auto_confirm: bool = Field(default=False, description="Skip confirmation prompts")

    @field_validator("migrations_dir")
    @classmethod
    def validate_migrations_dir(cls, v):
        if not isinstance(v, Path):
            v = Path(v)
        return v


class MigrationFile(BaseModel):
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


def load_config() -> tuple[DatabaseConfig, MigrationConfig]:
    try:
        db_config = DatabaseConfig(
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "5432")),
            name=os.getenv("POSTGRES_DB", "linguaquiz_db"),
            user=os.getenv("POSTGRES_USER", "linguaquiz_user"),
            password=os.getenv("POSTGRES_PASSWORD", ""),
        )

        auto_confirm = os.getenv("CI") == "true" or os.getenv("KUBERNETES_SERVICE_HOST") is not None or os.getenv("DOCKER_ENVIRONMENT") == "true"

        migration_config = MigrationConfig(
            migrations_dir=Path(os.getenv("MIGRATIONS_DIR", "./migrations")),
            auto_confirm=auto_confirm,
        )

        return db_config, migration_config

    except Exception as e:
        print(f"{RED}✗ Configuration validation failed: {e}{RESET}")
        sys.exit(1)


GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
RESET = "\033[0m"


def get_connection(db_config: DatabaseConfig):
    return psycopg2.connect(
        host=db_config.host,
        port=db_config.port,
        database=db_config.name,
        user=db_config.user,
        password=db_config.password,
    )


def get_migration_files(migration_config: MigrationConfig) -> list[MigrationFile]:
    if not migration_config.migrations_dir.exists():
        print(f"{RED}Migration directory not found: {migration_config.migrations_dir}{RESET}")
        sys.exit(1)

    init_sql_path = migration_config.migrations_dir / "init.sql"
    if not init_sql_path.exists():
        print(f"{RED}init.sql not found in migrations directory{RESET}")
        sys.exit(1)

    try:
        content = init_sql_path.read_text(encoding="utf-8")
        migration_file = MigrationFile(filename="init.sql", filepath=init_sql_path, content=content)
        return [migration_file]
    except Exception as e:
        print(f"{RED}Error reading init.sql: {e}{RESET}")
        sys.exit(1)


def run_migration(conn, migration_file: MigrationFile) -> bool:
    try:
        with conn.cursor() as cur:
            cur.execute(migration_file.content)
            conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"{RED}Error in {migration_file.filename}: {e}{RESET}")
        return False


def load_vocabulary_files(conn, migration_config: MigrationConfig) -> bool:
    vocabulary_dir = migration_config.migrations_dir / "data" / "vocabulary"

    if not vocabulary_dir.exists():
        print(f"{YELLOW}⚠ Vocabulary directory not found: {vocabulary_dir}{RESET}")
        print(f"{YELLOW}⚠ Skipping vocabulary loading{RESET}")
        return True

    json_files = sorted(vocabulary_dir.glob("*.json"))

    if not json_files:
        print(f"{YELLOW}⚠ No vocabulary JSON files found{RESET}")
        return True

    print(f"\n{GREEN}Loading vocabulary from {len(json_files)} JSON files{RESET}\n")

    total_inserted = 0
    total_skipped = 0

    for json_file in json_files:
        try:
            with open(json_file, encoding="utf-8") as f:
                vocabulary_data = json.load(f)

            print(f"Loading {json_file.name}...", end=" ", flush=True)

            with conn.cursor() as cur:
                cur.execute("SELECT inserted_count, skipped_count FROM load_vocabulary_from_json(%s)", (Json(vocabulary_data),))
                result = cur.fetchone()
                if result:
                    inserted, skipped = result
                    total_inserted += inserted
                    total_skipped += skipped
                    print(f"{GREEN}✓ ({inserted} inserted, {skipped} skipped){RESET}")
                else:
                    print(f"{RED}✗ No result returned{RESET}")
                    return False

            conn.commit()

        except Exception as e:
            conn.rollback()
            print(f"{RED}✗ Error loading {json_file.name}: {e}{RESET}")
            return False

    print(f"\n{GREEN}✓ Vocabulary loading complete: {total_inserted} words inserted, {total_skipped} skipped{RESET}")
    return True


def main():
    print(f"{GREEN}LinguaQuiz Migration Runner{RESET}")

    db_config, migration_config = load_config()

    print(f"Database: {db_config.user}@{db_config.host}:{db_config.port}/{db_config.name}")
    print(f"Migrations directory: {migration_config.migrations_dir}")
    print(f"Auto-confirm: {migration_config.auto_confirm}\n")

    try:
        conn = get_connection(db_config)
        print(f"{GREEN}✓ Connected to database{RESET}")
    except Exception as e:
        print(f"{RED}✗ Failed to connect to database: {e}{RESET}")
        sys.exit(1)

    try:
        migration_files = get_migration_files(migration_config)
        print(f"Found {len(migration_files)} migration files\n")

        if not migration_files:
            print(f"{GREEN}✓ No migrations to run{RESET}")
            return

        if not migration_config.auto_confirm:
            print(f"{YELLOW}Will run the following migrations:{RESET}")
            for migration_file in migration_files:
                print(f"  - {migration_file.filename}")
            if input("\nContinue? (y/N): ").lower() != "y":
                print("Aborted.")
                return

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

        # Load vocabulary data
        if not load_vocabulary_files(conn, migration_config):
            print(f"{RED}✗ VOCABULARY LOADING FAILED. ABORTING.{RESET}")
            sys.exit(1)

    finally:
        conn.close()


if __name__ == "__main__":
    main()
