-- Word table
CREATE TABLE IF NOT EXISTS word (
  id SERIAL PRIMARY KEY,
  text VARCHAR(255) NOT NULL,
  language_id INTEGER NOT NULL REFERENCES language (id),
  usage_example TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_word_language ON word (language_id);
CREATE INDEX IF NOT EXISTS idx_word_text ON word (text);
CREATE INDEX IF NOT EXISTS idx_word_language_text ON word (language_id, text);

-- Note: Removed unique constraint to allow data import flexibility
-- Words can have duplicates across imports, handled at application level

-- Drop the unique constraint if it exists (for migration compatibility)
DROP INDEX IF EXISTS idx_word_unique_per_language;

-- Text utility functions
-- Function to clean pipe-separated alternatives (show only first alternative)
CREATE OR REPLACE FUNCTION util_clean_pipe_alternatives(p_text TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN CASE 
        WHEN position('|' in p_text) > 0 THEN split_part(p_text, '|', 1)
        ELSE p_text 
    END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to normalize text for answer comparison
CREATE OR REPLACE FUNCTION util_normalize_answer(p_text TEXT) 
RETURNS TEXT AS $$
BEGIN
    RETURN lower(trim(regexp_replace(p_text, '[^\w\s]', '', 'g')));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to clean JSONB word data by removing pipe alternatives
CREATE OR REPLACE FUNCTION util_clean_word_data(p_word_data JSONB) 
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_set(
        jsonb_set(
            p_word_data,
            '{source}',
            to_jsonb(util_clean_pipe_alternatives(p_word_data->>'source'))
        ),
        '{target}',
        to_jsonb(util_clean_pipe_alternatives(p_word_data->>'target'))
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
