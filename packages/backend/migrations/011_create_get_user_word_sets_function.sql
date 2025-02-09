CREATE
OR REPLACE FUNCTION get_user_word_sets (p_user_id INTEGER, p_word_list_name VARCHAR) RETURNS TABLE (
  word_pair_id INTEGER,
  status VARCHAR,
  source_word VARCHAR(255),
  target_word VARCHAR(255),
  source_language VARCHAR(50),
  target_language VARCHAR(50),
  source_word_usage_example TEXT,
  target_word_usage_example TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH user_words AS (
    SELECT 
      t.id AS word_pair_id,
      COALESCE(utp.status::VARCHAR, 'LEVEL_0') AS status,
      sw.text AS source_word,
      tw.text AS target_word,
      sl.name AS source_language,
      tl.name AS target_language,
      sw.usage_example AS source_word_usage_example,
      tw.usage_example AS target_word_usage_example
    FROM 
      word_list_entry wle
    JOIN 
      translation t ON wle.translation_id = t.id
    JOIN 
      word sw ON t.source_word_id = sw.id
    JOIN 
      word tw ON t.target_word_id = tw.id
    JOIN 
      language sl ON sw.language_id = sl.id
    JOIN 
      language tl ON tw.language_id = tl.id
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
      WHEN user_words.status = 'LEVEL_1' THEN 1   -- Learning
      WHEN user_words.status = 'LEVEL_0' THEN 2   -- New
      WHEN user_words.status = 'LEVEL_2' THEN 3   -- Translation (One Way)
      WHEN user_words.status = 'LEVEL_3' THEN 4   -- Translation (Both Ways)
      WHEN user_words.status = 'LEVEL_4' THEN 5   -- Usage (One Way)
      WHEN user_words.status = 'LEVEL_5' THEN 6   -- Usage (Both Ways)
      ELSE 7
    END,
    word_pair_id;
END;
$$ LANGUAGE plpgsql;
