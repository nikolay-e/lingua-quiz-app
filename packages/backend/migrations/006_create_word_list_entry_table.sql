CREATE TABLE word_list_entry (
  id SERIAL PRIMARY KEY,
  word_id INTEGER REFERENCES word (id) ON DELETE CASCADE,
  word_list_id INTEGER REFERENCES word_list (id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (word_id, word_list_id)
);

CREATE INDEX idx_word_list_entry_word ON word_list_entry (word_id);

CREATE INDEX idx_word_list_entry_list ON word_list_entry (word_list_id);
