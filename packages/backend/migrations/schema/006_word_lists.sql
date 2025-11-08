CREATE TABLE IF NOT EXISTS word_lists (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS word_list_entries (
    id SERIAL PRIMARY KEY,
    translation_id INTEGER REFERENCES translations (id) ON DELETE CASCADE,
    word_list_id INTEGER REFERENCES word_lists (id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (translation_id, word_list_id)
);

CREATE INDEX IF NOT EXISTS idx_word_lists_name ON word_lists (name);
CREATE INDEX IF NOT EXISTS idx_word_list_entries_translation
ON word_list_entries (translation_id);
CREATE INDEX IF NOT EXISTS idx_word_list_entries_list ON word_list_entries (
    word_list_id
);
CREATE INDEX IF NOT EXISTS idx_word_list_entries_list_translation
ON word_list_entries (word_list_id, translation_id);

CREATE OR REPLACE FUNCTION UPDATE_TIMESTAMP() RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_word_list_timestamp') THEN
    CREATE TRIGGER update_word_list_timestamp
    BEFORE UPDATE ON word_lists
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

DROP FUNCTION IF EXISTS get_word_lists();

CREATE OR REPLACE FUNCTION GET_WORD_LISTS() RETURNS TABLE (
    id INTEGER,
    name VARCHAR(255),
    word_count INTEGER,
    created_at TEXT,
    updated_at TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    wl.id,
    wl.name,
    (SELECT COUNT(*) FROM word_list_entries WHERE word_list_id = wl.id)::INTEGER AS word_count,
    wl.created_at::TEXT AS created_at,
    wl.updated_at::TEXT AS updated_at
  FROM word_lists wl
  ORDER BY wl.name ASC;
END;
$$ LANGUAGE plpgsql;
