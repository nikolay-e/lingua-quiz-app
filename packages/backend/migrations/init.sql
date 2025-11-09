CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE word_pairs (
    source_text TEXT NOT NULL,
    source_lang VARCHAR(10) NOT NULL,
    target_text TEXT NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    list_name TEXT NOT NULL,
    source_example TEXT,
    target_example TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (source_text, source_lang, target_lang)
);

CREATE INDEX idx_word_pairs_list ON word_pairs (list_name, source_lang);

CREATE TABLE user_progress (
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    source_text TEXT NOT NULL,
    source_lang VARCHAR(10) NOT NULL,
    target_lang VARCHAR(10) NOT NULL,
    level INTEGER DEFAULT 0 CHECK (level BETWEEN 0 AND 5),
    correct_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    last_practiced TIMESTAMP WITH TIME ZONE,

    PRIMARY KEY (user_id, source_text, source_lang, target_lang),
    FOREIGN KEY (source_text, source_lang, target_lang)
    REFERENCES word_pairs (source_text, source_lang, target_lang)
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
