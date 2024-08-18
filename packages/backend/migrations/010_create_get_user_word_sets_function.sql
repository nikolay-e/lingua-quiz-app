CREATE
OR REPLACE FUNCTION get_user_word_sets (p_user_id INTEGER, p_word_list_name VARCHAR) RETURNS TABLE (
  word_pair_id INTEGER,
  status VARCHAR,
  source_word VARCHAR(255),
  target_word VARCHAR(255),
  source_language_id VARCHAR(10),
  target_language_id VARCHAR(10)
) AS $$
BEGIN
  RETURN QUERY
  WITH user_words AS (
    SELECT 
      t.id AS word_pair_id,
      COALESCE(utp.status::VARCHAR, 'Upcoming Words') AS status,
      sw.text AS source_word,
      tw.text AS target_word,
      sw.language_id AS source_language_id,
      tw.language_id AS target_language_id
    FROM 
      word_list_entry wle
    JOIN 
      word sw ON wle.word_id = sw.id
    JOIN 
      translation t ON sw.id = t.source_word_id
    JOIN 
      word tw ON t.target_word_id = tw.id
    JOIN 
      word_list wl ON wle.word_list_id = wl.id
    LEFT JOIN 
      user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
    WHERE 
      wl.name = p_word_list_name
  )
  SELECT * FROM user_words
  ORDER BY 
    CASE 
      WHEN user_words.status = 'Focus Words' THEN 1
      WHEN user_words.status = 'Upcoming Words' THEN 2
      WHEN user_words.status = 'Mastered One Direction' THEN 3
      WHEN user_words.status = 'Mastered Vocabulary' THEN 4
      ELSE 5
    END,
    user_words.source_word;
END;
$$ LANGUAGE plpgsql;
