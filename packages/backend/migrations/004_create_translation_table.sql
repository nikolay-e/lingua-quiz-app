CREATE TABLE IF NOT EXISTS translation (
  id SERIAL PRIMARY KEY,
  source_word_id INTEGER NOT NULL REFERENCES word (id),
  target_word_id INTEGER NOT NULL REFERENCES word (id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_word_id, target_word_id)
);

CREATE INDEX idx_translation_source ON translation (source_word_id);

CREATE INDEX idx_translation_target ON translation (target_word_id);
