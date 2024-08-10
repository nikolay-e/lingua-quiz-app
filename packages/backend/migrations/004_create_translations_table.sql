CREATE TABLE IF NOT EXISTS translations (
  id SERIAL PRIMARY KEY,
  word_id INTEGER NOT NULL REFERENCES words (id),
  translation_id INTEGER NOT NULL REFERENCES words (id),
  UNIQUE (word_id, translation_id)
);
