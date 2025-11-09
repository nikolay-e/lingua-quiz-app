CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE translations (
    source_text TEXT NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    target_text TEXT NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    list_name TEXT NOT NULL,
    source_usage_example TEXT,
    target_usage_example TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (source_text, source_language, target_language)
);

CREATE INDEX idx_translations_list ON translations (list_name, source_language);

CREATE TABLE user_progress (
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    source_text TEXT NOT NULL,
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    level INTEGER DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
    queue_position INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    incorrect_count INTEGER DEFAULT 0,
    last_practiced TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (user_id, source_text, source_language, target_language),
    FOREIGN KEY (source_text, source_language, target_language)
    REFERENCES translations (source_text, source_language, target_language)
    ON DELETE CASCADE
);

CREATE INDEX idx_progress_user_level ON user_progress (user_id, level);
CREATE INDEX idx_progress_last_practiced ON user_progress (user_id, last_practiced);

CREATE TABLE tts_cache (
    text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL,
    audio_data BYTEA NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (text, language)
);

CREATE INDEX idx_tts_cache_created ON tts_cache (created_at);

-- Function to load vocabulary from JSON files
CREATE OR REPLACE FUNCTION LOAD_VOCABULARY_FROM_JSON(vocabulary_json JSONB)
RETURNS TABLE (inserted_count INTEGER, skipped_count INTEGER) AS $$
DECLARE
    word_pair JSONB;
    source_lang_code VARCHAR(10);
    target_lang_code VARCHAR(10);
    list_name_text TEXT;
    inserted INTEGER := 0;
    skipped INTEGER := 0;
BEGIN
    -- Extract language codes and list name from JSON
    source_lang_code := CASE
        WHEN vocabulary_json->>'source_language' = 'English' THEN 'en'
        WHEN vocabulary_json->>'source_language' = 'German' THEN 'de'
        WHEN vocabulary_json->>'source_language' = 'Spanish' THEN 'es'
        WHEN vocabulary_json->>'source_language' = 'Russian' THEN 'ru'
        ELSE LOWER(SUBSTRING(vocabulary_json->>'source_language', 1, 2))
    END;

    target_lang_code := CASE
        WHEN vocabulary_json->>'target_language' = 'English' THEN 'en'
        WHEN vocabulary_json->>'target_language' = 'German' THEN 'de'
        WHEN vocabulary_json->>'target_language' = 'Spanish' THEN 'es'
        WHEN vocabulary_json->>'target_language' = 'Russian' THEN 'ru'
        ELSE LOWER(SUBSTRING(vocabulary_json->>'target_language', 1, 2))
    END;

    list_name_text := vocabulary_json->>'word_list_name';

    -- Insert each translation
    FOR word_pair IN SELECT * FROM jsonb_array_elements(vocabulary_json->'word_pairs')
    LOOP
        BEGIN
            INSERT INTO translations (
                source_text,
                source_language,
                target_text,
                target_language,
                list_name,
                source_usage_example,
                target_usage_example
            ) VALUES (
                word_pair->>'source_word',
                source_lang_code,
                word_pair->>'target_word',
                target_lang_code,
                list_name_text,
                word_pair->>'source_example',
                word_pair->>'target_example'
            )
            ON CONFLICT (source_text, source_language, target_language) DO NOTHING;

            IF FOUND THEN
                inserted := inserted + 1;
            ELSE
                skipped := skipped + 1;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                skipped := skipped + 1;
                RAISE NOTICE 'Skipped word pair: % - %', word_pair->>'source_word', SQLERRM;
        END;
    END LOOP;

    RETURN QUERY SELECT inserted, skipped;
END;
$$ LANGUAGE plpgsql;
