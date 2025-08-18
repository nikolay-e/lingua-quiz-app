-- TTS cache table and functions
CREATE TABLE IF NOT EXISTS tts_caches (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(32) UNIQUE NOT NULL,
    text_content TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    audio_data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced TTS cache function for better compatibility
CREATE OR REPLACE FUNCTION GET_TTS_CACHE_ENTRY_VALIDATED_FIXED(
    p_cache_key VARCHAR(32),
    p_text TEXT
) RETURNS TABLE (audio_data BYTEA, is_valid_text BOOLEAN) AS $$
DECLARE
    text_clean TEXT;
    is_allowed BOOLEAN := FALSE;
BEGIN
    text_clean := LOWER(TRIM(p_text));

    -- Check if text exists in valid texts view
    SELECT EXISTS (
        SELECT 1 FROM valid_tts_texts
        WHERE clean_text = text_clean
    ) INTO is_allowed;

    IF is_allowed THEN
        RETURN QUERY
        UPDATE tts_caches
        SET last_accessed_at = CURRENT_TIMESTAMP
        WHERE cache_key = p_cache_key
        RETURNING COALESCE(tts_caches.audio_data, NULL), TRUE;

        IF NOT FOUND THEN
            RETURN QUERY SELECT NULL::BYTEA, TRUE;
        END IF;
    ELSE
        RETURN QUERY SELECT NULL::BYTEA, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tts_caches_key ON tts_caches (cache_key);
CREATE INDEX IF NOT EXISTS idx_tts_caches_created_at ON tts_caches (created_at);
CREATE INDEX IF NOT EXISTS idx_tts_caches_last_accessed ON tts_caches (
    last_accessed_at
);

-- Views
CREATE OR REPLACE VIEW valid_tts_texts AS
SELECT DISTINCT LOWER(TRIM(text)) AS clean_text FROM (
    SELECT w1.text FROM words AS w1
    UNION ALL
    SELECT w2.text FROM words AS w2
    UNION ALL
    SELECT w1.usage_example
    FROM words AS w1
    WHERE w1.usage_example IS NOT NULL
    UNION ALL
    SELECT w2.usage_example
    FROM words AS w2
    WHERE w2.usage_example IS NOT NULL
) AS t;

-- Functions
CREATE OR REPLACE FUNCTION GET_TTS_CACHE_ENTRY_VALIDATED(
    p_cache_key VARCHAR(32),
    p_text TEXT
) RETURNS TABLE (audio_data BYTEA, is_valid_text BOOLEAN) AS $$
DECLARE
    text_clean TEXT;
    is_allowed BOOLEAN := FALSE;
BEGIN
    -- Clean the text for comparison
    text_clean := LOWER(TRIM(p_text));

    -- Check if text exists in valid texts view
    SELECT EXISTS (
        SELECT 1 FROM valid_tts_texts
        WHERE clean_text = text_clean
    ) INTO is_allowed;

    -- Only return cache data if text is allowed
    IF is_allowed THEN
        RETURN QUERY
        UPDATE tts_caches
        SET last_accessed_at = CURRENT_TIMESTAMP
        WHERE cache_key = p_cache_key
        RETURNING tts_caches.audio_data, TRUE;

        -- If no cache hit, return null audio but valid text flag
        IF NOT FOUND THEN
            RETURN QUERY SELECT NULL::BYTEA, TRUE;
        END IF;
    ELSE
        -- Text not allowed, return invalid flag
        RETURN QUERY SELECT NULL::BYTEA, FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to save TTS cache entry (only if text is valid)
CREATE OR REPLACE FUNCTION SAVE_TTS_CACHE_ENTRY_VALIDATED(
    p_cache_key VARCHAR(32),
    p_text_content TEXT,
    p_language VARCHAR(50),
    p_audio_data BYTEA,
    p_file_size INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    text_clean TEXT;
    is_allowed BOOLEAN := FALSE;
BEGIN
    -- Clean the text for comparison
    text_clean := LOWER(TRIM(p_text_content));

    -- Check if text exists in database words/phrases using correct schema
    SELECT EXISTS (
        SELECT 1 FROM words w1
        JOIN translations t ON w1.id = t.source_word_id
        JOIN words w2 ON t.target_word_id = w2.id
        WHERE LOWER(w1.text) = text_clean
           OR LOWER(w2.text) = text_clean
           OR LOWER(w1.usage_example) = text_clean
           OR LOWER(w2.usage_example) = text_clean
    ) INTO is_allowed;

    -- Only save if text is allowed
    IF is_allowed THEN
        INSERT INTO tts_caches
        (cache_key, text_content, language, audio_data, file_size)
        VALUES (p_cache_key, LEFT(p_text_content, 500), p_language, p_audio_data, p_file_size)
        ON CONFLICT (cache_key) DO UPDATE SET
            audio_data = EXCLUDED.audio_data,
            text_content = EXCLUDED.text_content,
            language = EXCLUDED.language,
            file_size = EXCLUDED.file_size,
            created_at = CURRENT_TIMESTAMP,
            last_accessed_at = CURRENT_TIMESTAMP;
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to get TTS cache statistics
CREATE OR REPLACE FUNCTION GET_TTS_CACHE_STATS()
RETURNS TABLE (
    total_entries BIGINT,
    total_size_bytes BIGINT,
    avg_size_bytes NUMERIC,
    oldest_entry TIMESTAMP WITH TIME ZONE,
    newest_entry TIMESTAMP WITH TIME ZONE,
    languages_cached BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*) as total_entries,
        COALESCE(SUM(file_size), 0) as total_size_bytes,
        COALESCE(AVG(file_size), 0) as avg_size_bytes,
        MIN(created_at) as oldest_entry,
        MAX(created_at) as newest_entry,
        COUNT(DISTINCT language) as languages_cached
    FROM tts_caches;
END;
$$ LANGUAGE plpgsql;
