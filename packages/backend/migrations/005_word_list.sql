-- Word list table
CREATE TABLE IF NOT EXISTS word_list (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Word list entry table
CREATE TABLE IF NOT EXISTS word_list_entry (
  id SERIAL PRIMARY KEY,
  translation_id INTEGER REFERENCES translation (id) ON DELETE CASCADE,
  word_list_id INTEGER REFERENCES word_list (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (translation_id, word_list_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_word_list_name ON word_list (name);
CREATE INDEX IF NOT EXISTS idx_word_list_entry_translation ON word_list_entry (translation_id);
CREATE INDEX IF NOT EXISTS idx_word_list_entry_list ON word_list_entry (word_list_id);
CREATE INDEX IF NOT EXISTS idx_word_list_entry_list_translation ON word_list_entry (word_list_id, translation_id);


-- Functions
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
