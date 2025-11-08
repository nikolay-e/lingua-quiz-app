CREATE TABLE IF NOT EXISTS words (
    id SERIAL PRIMARY KEY,
    text VARCHAR(255) NOT NULL,
    language_id INTEGER NOT NULL REFERENCES languages (id),
    usage_example TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_words_language ON words (language_id);
CREATE INDEX IF NOT EXISTS idx_words_text ON words (text);
CREATE INDEX IF NOT EXISTS idx_words_language_text ON words (language_id, text);
