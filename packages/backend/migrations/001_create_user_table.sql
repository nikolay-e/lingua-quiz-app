-- LinguaQuiz - Copyright © 2025 Nikolay Eremeev
--
-- Dual-licensed:
--  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
--  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
--
-- Contact: lingua-quiz@nikolay-eremeev.com
-- Repository: https://github.com/nikolay-e/lingua-quiz
-- File: packages/backend/migrations/001_create_user_table.sql

-- Migration: Change email to username
-- Drop existing constraints and indexes
DROP INDEX IF EXISTS idx_user_email;
ALTER TABLE IF EXISTS "user" DROP CONSTRAINT IF EXISTS user_email_key;

-- Rename email column to username if it exists
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user' AND column_name = 'email') THEN
        ALTER TABLE "user" RENAME COLUMN email TO username;
    END IF;
END $$;
CREATE TABLE IF NOT EXISTS "user" (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_username ON "user" (username);
