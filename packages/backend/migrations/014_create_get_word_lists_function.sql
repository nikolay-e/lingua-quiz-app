CREATE OR REPLACE FUNCTION get_word_lists () RETURNS TABLE (
  id INTEGER,
  name VARCHAR(255),
  created_at TEXT,
  updated_at TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    word_list.id,
    word_list.name,
    word_list.created_at::TEXT AS created_at,
    word_list.updated_at::TEXT AS updated_at
  FROM word_list
  ORDER BY word_list.name ASC;
END;
$$ LANGUAGE plpgsql;
