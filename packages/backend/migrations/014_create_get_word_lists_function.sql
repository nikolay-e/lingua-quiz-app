-- LinguaQuiz - Copyright © 2025 Nikolay Eremeev
--
-- Dual-licensed:
--  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
--  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
--
-- Contact: lingua-quiz@nikolay-eremeev.com
-- Repository: https://github.com/nikolay-e/lingua-quiz
-- File: packages/backend/migrations/014_create_get_word_lists_function.sql
-- Drop function if exists to handle signature changes
DROP FUNCTION IF EXISTS get_word_lists();

CREATE OR REPLACE FUNCTION get_word_lists () RETURNS TABLE (
  id INTEGER,
  name VARCHAR(255),
  word_count INTEGER,
  created_at TEXT,
  updated_at TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    word_list.id,
    word_list.name,
    (SELECT COUNT(*) FROM word_list_entry WHERE word_list_id = word_list.id)::INTEGER AS word_count,
    word_list.created_at::TEXT AS created_at,
    word_list.updated_at::TEXT AS updated_at
  FROM word_list
  ORDER BY word_list.name ASC;
END;
$$ LANGUAGE plpgsql;
