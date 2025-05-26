#!/usr/bin/env python3
"""
LinguaQuiz Minimal Migration Tool
Single-file database migration runner
"""

import os
import sys
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

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

def calculate_checksum(content):
    """Calculate SHA-256 checksum of file content"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def init_migration_table(conn):
    """Initialize schema_migrations table if it doesn't exist"""
    with conn.cursor() as cur:
        cur.execute("""
            CREATE TABLE IF NOT EXISTS schema_migrations (
                id SERIAL PRIMARY KEY,
                version VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                checksum VARCHAR(64)
            );
        """)
        conn.commit()

def get_applied_migrations(conn):
    """Get list of already applied migrations with their checksums"""
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT version, checksum FROM schema_migrations ORDER BY id")
            result = {row['version']: row['checksum'] for row in cur.fetchall()}
        # Ensure transaction is properly closed
        txn_status = conn.get_transaction_status()
        if txn_status == 0:  # IDLE
            pass  # No action needed
        elif txn_status == 1:  # INTRANS - normal transaction
            conn.commit()
        elif txn_status == 2:  # INERROR - failed transaction 
            conn.rollback()
        elif txn_status == 3:  # INTRANS (subxact) - in subtransaction
            conn.commit()
        elif txn_status == 4:  # INERROR (subxact) - failed subtransaction  
            conn.rollback()
        elif txn_status == 5:  # INTRANS_READONLY - read-only transaction
            conn.rollback()  # Can't commit readonly transaction
        else:  # UNKNOWN or future states
            conn.rollback()  # Safe default
        return result
    except Exception as e:
        # Rollback on any error and return empty dict
        if conn.get_transaction_status() != 0:
            conn.rollback()
        return {}

def get_migration_files():
    """Get sorted list of migration files"""
    if not os.path.exists(MIGRATIONS_DIR):
        print(f"{RED}Migration directory not found: {MIGRATIONS_DIR}{RESET}")
        sys.exit(1)
    
    files = [f for f in os.listdir(MIGRATIONS_DIR) if f.endswith('.sql')]
    return sorted(files)

def run_migration(conn, filename, content, checksum):
    """Run a single migration"""
    with conn.cursor() as cur:
        try:
            # Start transaction
            conn.autocommit = False
            
            # Execute migration
            cur.execute(content)
            
            # Record migration
            cur.execute(
                "INSERT INTO schema_migrations (version, checksum) VALUES (%s, %s)",
                (filename, checksum)
            )
            
            # Commit transaction
            conn.commit()
            return True
            
        except Exception as e:
            # Rollback on error
            conn.rollback()
            raise e
        finally:
            conn.autocommit = True

def main():
    """Main migration runner"""
    print(f"{GREEN}LinguaQuiz Migration Tool{RESET}")
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
        # Initialize migration table
        init_migration_table(conn)
        
        # Get applied migrations
        applied = get_applied_migrations(conn)
        print(f"Found {len(applied)} applied migrations")
        
        # Get migration files
        files = get_migration_files()
        print(f"Found {len(files)} migration files")
        
        # Find pending migrations and check for changed import migrations
        pending = []
        changed_imports = []
        
        for filename in files:
            filepath = os.path.join(MIGRATIONS_DIR, filename)
            with open(filepath, 'r') as f:
                content = f.read()
            current_checksum = calculate_checksum(content)
            
            if filename not in applied:
                # New migration
                pending.append(filename)
            elif 'import' in filename and applied.get(filename) != current_checksum:
                # Import migration with changed content
                changed_imports.append((filename, current_checksum))
        
        if not pending and not changed_imports:
            print(f"\n{GREEN}✓ Database is up to date!{RESET}")
            return
        
        if pending:
            print(f"\n{YELLOW}Pending migrations:{RESET}")
            for f in pending:
                print(f"  - {f}")
        
        if changed_imports:
            print(f"\n{YELLOW}Changed import migrations (will re-run):{RESET}")
            for f, _ in changed_imports:
                print(f"  - {f}")
        
        # Ask for confirmation (skip in CI/CD environments)
        if os.getenv('CI') != 'true' and os.getenv('KUBERNETES_SERVICE_HOST') is None and os.getenv('DOCKER_ENVIRONMENT') != 'true':
            if input("\nApply migrations? (y/N): ").lower() != 'y':
                print("Aborted.")
                return
        
        # Run pending migrations and re-run changed imports
        print()
        all_to_run = [(f, None) for f in pending] + changed_imports
        
        for filename, new_checksum in all_to_run:
            filepath = os.path.join(MIGRATIONS_DIR, filename)
            
            if new_checksum:
                # Re-running changed import
                print(f"Re-running {filename} (content changed)...", end=' ')
            else:
                print(f"Running {filename}...", end=' ')
            
            try:
                # Read migration file
                with open(filepath, 'r') as f:
                    content = f.read()
                
                # Calculate checksum if not provided
                checksum = new_checksum or calculate_checksum(content)
                
                # For re-runs, update the existing record
                if new_checksum:
                    with conn.cursor() as cur:
                        cur.execute("""
                            UPDATE schema_migrations 
                            SET checksum = %s, applied_at = NOW() 
                            WHERE version = %s
                        """, (checksum, filename))
                        conn.commit()
                    
                    # Now run the migration content
                    with conn.cursor() as cur:
                        cur.execute(content)
                        conn.commit()
                else:
                    # Normal migration run
                    run_migration(conn, filename, content, checksum)
                
                print(f"{GREEN}✓{RESET}")
                
            except Exception as e:
                print(f"{RED}✗{RESET}")
                print(f"{RED}Error: {e}{RESET}")
                sys.exit(1)
        
        print(f"\n{GREEN}✓ All migrations completed successfully!{RESET}")
        
    finally:
        conn.close()

def rollback(steps=1):
    """Rollback migrations (optional feature)"""
    print(f"{YELLOW}Rollback feature not implemented in minimal version{RESET}")
    print("To rollback, manually reverse the SQL changes and delete from schema_migrations table")

def status():
    """Show migration status"""
    try:
        conn = get_connection()
        init_migration_table(conn)
        
        applied = get_applied_migrations(conn)
        files = get_migration_files()
        pending = [f for f in files if f not in applied]
        
        print(f"\n{GREEN}Applied migrations:{RESET}")
        for version in applied:
            print(f"  ✓ {version}")
        
        if pending:
            print(f"\n{YELLOW}Pending migrations:{RESET}")
            for f in pending:
                print(f"  - {f}")
        else:
            print(f"\n{GREEN}✓ No pending migrations{RESET}")
        
        conn.close()
        
    except Exception as e:
        print(f"{RED}Error: {e}{RESET}")
        sys.exit(1)

if __name__ == '__main__':
    # Simple command line interface
    if len(sys.argv) > 1:
        command = sys.argv[1]
        if command == 'status':
            status()
        elif command == 'rollback':
            steps = int(sys.argv[2]) if len(sys.argv) > 2 else 1
            rollback(steps)
        elif command == 'help':
            print("Usage:")
            print("  python migrate.py         # Run pending migrations")
            print("  python migrate.py status  # Show migration status")
            print("  python migrate.py help    # Show this help")
        else:
            print(f"Unknown command: {command}")
            print("Run 'python migrate.py help' for usage")
    else:
        main()