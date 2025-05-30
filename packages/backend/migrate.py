#!/usr/bin/env python3
"""
LinguaQuiz Simple Migration Runner
Runs all SQL files in migrations directory in order
"""

import os
import sys
import psycopg2

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('POSTGRES_DB', 'linguaquiz_db')
DB_USER = os.getenv('POSTGRES_USER', 'linguaquiz_user')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', '')
MIGRATIONS_DIR = os.getenv('MIGRATIONS_DIR', './migrations')

# Colors for output
GREEN = '\033[92m'
YELLOW = '\033[93m'
RED = '\033[91m'
RESET = '\033[0m'

def get_connection():
    """Get database connection"""
    return psycopg2.connect(
        host=DB_HOST,
        port=DB_PORT,
        database=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD
    )

def get_migration_files():
    """Get sorted list of migration files"""
    if not os.path.exists(MIGRATIONS_DIR):
        print(f"{RED}Migration directory not found: {MIGRATIONS_DIR}{RESET}")
        sys.exit(1)
    
    files = [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql')]
    # Skip the old schema migrations table file
    files = [f for f in files if f != '000_schema_migrations_table.sql']
    return sorted(files)

def run_migration(conn, filename, content):
    """Run a single migration"""
    try:
        with conn.cursor() as cur:
            cur.execute(content)
            conn.commit()
        return True
    except Exception as e:
        conn.rollback()
        print(f"{RED}Error in {filename}: {e}{RESET}")
        return False

def main():
    """Main migration runner"""
    print(f"{GREEN}LinguaQuiz Migration Runner{RESET}")
    print(f"Database: {DB_USER}@{DB_HOST}:{DB_PORT}/{DB_NAME}")
    print(f"Migrations directory: {MIGRATIONS_DIR}\n")
    
    # Connect to database
    try:
        conn = get_connection()
        print(f"{GREEN}✓ Connected to database{RESET}")
    except Exception as e:
        print(f"{RED}✗ Failed to connect to database: {e}{RESET}")
        sys.exit(1)
    
    try:
        # Get migration files
        files = get_migration_files()
        print(f"Found {len(files)} migration files\n")
        
        if not files:
            print(f"{GREEN}✓ No migrations to run{RESET}")
            return
        
        # Ask for confirmation (skip in CI/CD environments)
        if os.getenv('CI') != 'true' and os.getenv('KUBERNETES_SERVICE_HOST') is None and os.getenv('DOCKER_ENVIRONMENT') != 'true':
            print(f"{YELLOW}Will run the following migrations:{RESET}")
            for f in files:
                print(f"  - {f}")
            if input("\nContinue? (y/N): ").lower() != 'y':
                print("Aborted.")
                return
        
        # Run all migrations
        print()
        success_count = 0
        for filename in files:
            filepath = os.path.join(MIGRATIONS_DIR, filename)
            print(f"Running {filename}...", end=' ', flush=True)
            
            try:
                with open(filepath, 'r') as f:
                    content = f.read()
                
                if run_migration(conn, filename, content):
                    print(f"{GREEN}✓{RESET}")
                    success_count += 1
                else:
                    print(f"{RED}✗{RESET}")
                    # Continue with other migrations even if one fails
                    
            except Exception as e:
                print(f"{RED}✗{RESET}")
                print(f"{RED}Error reading file: {e}{RESET}")
        
        print(f"\n{GREEN}✓ Completed: {success_count}/{len(files)} migrations successful{RESET}")
        
        if success_count < len(files):
            print(f"{YELLOW}⚠ Some migrations failed. Check the errors above.{RESET}")
            sys.exit(1)
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()