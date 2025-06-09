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
DECLARE
    v_groups TEXT[];
    v_cleaned_groups TEXT[] := '{}';
    v_group TEXT;
    i INTEGER;
BEGIN
    -- Handle parentheses grouping like "(a|b), (c|d)" -> "a, c"
    IF position('(' in p_text) > 0 AND position(',' in p_text) > 0 THEN
        v_groups := regexp_split_to_array(trim(p_text), '\s*,\s*');
        
        FOR i IN 1..array_length(v_groups, 1) LOOP
            v_group := trim(v_groups[i]);
            IF position('(' in v_group) > 0 THEN
                -- Extract content within parentheses and take first pipe alternative
                v_group := trim(regexp_replace(v_group, '^\s*\(([^)]*)\)\s*$', '\1'));
                v_group := split_part(v_group, '|', 1);
            END IF;
            v_cleaned_groups := array_append(v_cleaned_groups, trim(v_group));
        END LOOP;
        
        RETURN array_to_string(v_cleaned_groups, ', ');
    END IF;
    
    -- Handle simple pipe separation
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
