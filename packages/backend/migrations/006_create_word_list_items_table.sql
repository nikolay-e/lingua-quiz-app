CREATE TABLE word_list_items (
  id SERIAL PRIMARY KEY,
  word_id INTEGER REFERENCES words (id) ON DELETE CASCADE,
  word_list_id INTEGER REFERENCES word_lists (id) ON DELETE CASCADE,
  UNIQUE (word_id, word_list_id)
);
