-- LinguaQuiz - Copyright © 2025 Nikolay Eremeev
--
-- Dual-licensed:
--  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
--  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
--
-- Contact: lingua-quiz@nikolay-eremeev.com
-- Repository: https://github.com/nikolay-e/lingua-quiz
-- File: packages/backend/migrations/006_create_word_list_entry_table.sql
CREATE TABLE IF NOT EXISTS word_list_entry (
  id SERIAL PRIMARY KEY,
  translation_id INTEGER REFERENCES translation (id) ON DELETE CASCADE,
  word_list_id INTEGER REFERENCES word_list (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (translation_id, word_list_id)
);

CREATE INDEX IF NOT EXISTS idx_word_list_entry_translation ON word_list_entry (translation_id);

CREATE INDEX IF NOT EXISTS idx_word_list_entry_list ON word_list_entry (word_list_id);
