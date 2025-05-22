/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/migrations/000_schema_migrations_table.sql
 */
-- Creates a table to track which migrations have been applied
-- This must be the first migration to run (hence 000_ prefix)
CREATE TABLE IF NOT EXISTS schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE, -- Migration file name
  applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  checksum VARCHAR(64) -- Optional SHA256 checksum of file content for integrity check
);

-- Create advisory lock function to prevent concurrent migrations
-- This will create a function that acquires a PostgreSQL advisory lock
-- with a consistent ID derived from the 'migrations' string
CREATE OR REPLACE FUNCTION acquire_migration_lock () RETURNS BOOLEAN AS $$
DECLARE
  -- Generate a consistent lock ID based on 'migrations' string
  lock_id INTEGER := ('x' || substr(md5('migrations'), 1, 8))::bit(32)::integer;
  lock_acquired BOOLEAN;
BEGIN
  -- Try to acquire the lock
  -- Returns TRUE if acquired, FALSE if not
  SELECT pg_try_advisory_lock(lock_id) INTO lock_acquired;
  RETURN lock_acquired;
END;
$$ LANGUAGE plpgsql;

-- Create function to release migration lock
CREATE OR REPLACE FUNCTION release_migration_lock () RETURNS VOID AS $$
DECLARE
  lock_id INTEGER := ('x' || substr(md5('migrations'), 1, 8))::bit(32)::integer;
BEGIN
  -- Release the lock
  PERFORM pg_advisory_unlock(lock_id);
END;
$$ LANGUAGE plpgsql;
