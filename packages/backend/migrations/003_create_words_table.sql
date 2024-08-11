CREATE TABLE IF NOT EXISTS words (
  id SERIAL PRIMARY KEY,
  word VARCHAR(255) NOT NULL,
  language_code VARCHAR(10) NOT NULL REFERENCES languages (code),
  usage_example TEXT,
  UNIQUE (word, language_code)
);
