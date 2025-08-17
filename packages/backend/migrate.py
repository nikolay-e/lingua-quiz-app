#!/usr/bin/env python3
"""
LinguaQuiz Migration Runner with Pydantic Validation
Runs all SQL files in migrations directory in order with proper validation
"""

import os
import sys
from typing import List, Optional
from pathlib import Path
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
    
    @field_validator('port')
    @classmethod
    def validate_port(cls, v):
        if not (1 <= v <= 65535):
            raise ValueError('Port must be between 1 and 65535')
        return v

class MigrationConfig(BaseModel):
    """Migration runner configuration with validation"""
    migrations_dir: Path = Field(default=Path("./migrations"), description="Migrations directory path")
    auto_confirm: bool = Field(default=False, description="Skip confirmation prompts")
    
    @field_validator('migrations_dir')
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
    
    @field_validator('filename')
    @classmethod
    def validate_filename(cls, v):
        if not v.endswith('.sql'):
            raise ValueError('Migration files must have .sql extension')
        return v
    
    @field_validator('filepath')
    @classmethod
    def validate_filepath(cls, v):
        if not isinstance(v, Path):
            v = Path(v)
        if not v.exists():
            raise ValueError(f'Migration file does not exist: {v}')
        return v

# =================================================================
# Configuration Loading with Validation
# =================================================================
def load_config() -> tuple[DatabaseConfig, MigrationConfig]:
    """Load and validate configuration from environment variables"""
    try:
        db_config = DatabaseConfig(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', '5432')),
            name=os.getenv('POSTGRES_DB', 'linguaquiz_db'),
            user=os.getenv('POSTGRES_USER', 'linguaquiz_user'),
            password=os.getenv('POSTGRES_PASSWORD', '')
        )
        
        # Auto-confirm in CI/CD environments
        auto_confirm = (
            os.getenv('CI') == 'true' or 
            os.getenv('KUBERNETES_SERVICE_HOST') is not None or 
            os.getenv('DOCKER_ENVIRONMENT') == 'true'
        )
        
        migration_config = MigrationConfig(
            migrations_dir=Path(os.getenv('MIGRATIONS_DIR', './migrations')),
            auto_confirm=auto_confirm
        )
        
        return db_config, migration_config
        
    except Exception as e:
        print(f"{RED}✗ Configuration validation failed: {e}{RESET}")
        sys.exit(1)

# Colors for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'

def get_connection(db_config: DatabaseConfig):
    """Get database connection using validated configuration"""
    return psycopg2.connect(
        host=db_config.host,
        port=db_config.port,
        database=db_config.name,
        user=db_config.user,
        password=db_config.password
    )

def get_migration_files(migration_config: MigrationConfig) -> List[MigrationFile]:
    """Get validated list of migration files from schema and data directories"""
    if not migration_config.migrations_dir.exists():
        print(f"{RED}Migration directory not found: {migration_config.migrations_dir}{RESET}")
        sys.exit(1)
    
    files = []
    
    # Load schema migrations first (001-010)
    schema_dir = migration_config.migrations_dir / 'schema'
    if schema_dir.exists():
        for filepath in sorted(schema_dir.glob('*.sql')):
            try:
                content = filepath.read_text(encoding='utf-8')
                migration_file = MigrationFile(
                    filename=filepath.name,
                    filepath=filepath,
                    content=content
                )
                files.append(migration_file)
            except Exception as e:
                print(f"{RED}Error reading schema migration file {filepath}: {e}{RESET}")
                sys.exit(1)
    
    # Load data migrations second (901+)
    data_dir = migration_config.migrations_dir / 'data'
    if data_dir.exists():
        for filepath in sorted(data_dir.glob('*.sql')):
            try:
                content = filepath.read_text(encoding='utf-8')
                migration_file = MigrationFile(
                    filename=filepath.name,
                    filepath=filepath,
                    content=content
                )
                files.append(migration_file)
            except Exception as e:
                print(f"{RED}Error reading data migration file {filepath}: {e}{RESET}")
                sys.exit(1)
    
    # Fallback: load any remaining files from root migrations directory
    for filepath in migration_config.migrations_dir.glob('*.sql'):
        # Skip the old schema migrations table file
        if filepath.name == '000_schema_migrations_table.sql':
            continue
            
        try:
            content = filepath.read_text(encoding='utf-8')
            migration_file = MigrationFile(
                filename=filepath.name,
                filepath=filepath,
                content=content
            )
            files.append(migration_file)
        except Exception as e:
            print(f"{RED}Error reading migration file {filepath}: {e}{RESET}")
            sys.exit(1)
    
    # Sort by numeric prefix to ensure proper order
    return sorted(files, key=lambda x: int(x.filename.split('_')[0]))

def run_migration(conn, migration_file: MigrationFile) -> bool:
    """Run a single validated migration"""
    try:
        with conn.cursor() as cur:
            cur.execute(migration_file.content)
            conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"{RED}Error in {migration_file.filename}: {e}{RESET}")
        return False

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
            if input("\nContinue? (y/N): ").lower() != 'y':
                print("Aborted.")
                return
        
        # Run all migrations
        print()
        success_count = 0
        for migration_file in migration_files:
            print(f"Running {migration_file.filename}...", end=' ', flush=True)
            
            if run_migration(conn, migration_file):
                print(f"{GREEN}✓{RESET}")
                success_count += 1
            else:
                print(f"{RED}✗{RESET}")
                # Continue with other migrations even if one fails
        
        print(f"\n{GREEN}✓ Completed: {success_count}/{len(migration_files)} migrations successful{RESET}")
        
        if success_count < len(migration_files):
            print(f"{YELLOW}⚠ Some migrations failed. Check the errors above.{RESET}")
            sys.exit(1)
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
