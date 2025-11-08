CREATE TABLE IF NOT EXISTS translations (
    id SERIAL PRIMARY KEY,
    source_word_id INTEGER NOT NULL REFERENCES words (id),
    target_word_id INTEGER NOT NULL REFERENCES words (id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (source_word_id, target_word_id)
);

CREATE INDEX IF NOT EXISTS idx_translations_source ON translations (
    source_word_id
);
CREATE INDEX IF NOT EXISTS idx_translations_target ON translations (
    target_word_id
);
