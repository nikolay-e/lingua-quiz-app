-- Cross-domain functions that span multiple database tables
-- Cleaned to keep only data migration functions

-- Word pair management functions (used in data migrations 901, 902)
CREATE OR REPLACE FUNCTION insert_word_pair_and_add_to_list (
  p_translation_id INTEGER,
  p_source_word_id INTEGER,
  p_target_word_id INTEGER,
  p_source_word VARCHAR(255),
  p_target_word VARCHAR(255),
  p_source_language_name VARCHAR(50),
  p_target_language_name VARCHAR(50),
  p_word_list_name VARCHAR(255),
  p_source_word_usage_example TEXT DEFAULT NULL,
  p_target_word_usage_example TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_word_list_id INTEGER;
  v_source_language_id INTEGER;
  v_target_language_id INTEGER;
BEGIN
  -- Insert or update the source language
  INSERT INTO language (id, name)
  VALUES (DEFAULT, p_source_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_source_language_id;

  -- Insert or update the target language
  INSERT INTO language (id, name)
  VALUES (DEFAULT, p_target_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_target_language_id;

  -- Insert or update the source word
  -- Force update all fields to ensure data is overwritten
  INSERT INTO word (id, text, language_id, usage_example)
  VALUES (p_source_word_id, p_source_word, v_source_language_id, p_source_word_usage_example)
  ON CONFLICT (id) DO UPDATE
  SET text = EXCLUDED.text,
      language_id = EXCLUDED.language_id,
      usage_example = EXCLUDED.usage_example;

  -- Insert or update the target word
  -- Force update all fields to ensure data is overwritten
  INSERT INTO word (id, text, language_id, usage_example)
  VALUES (p_target_word_id, p_target_word, v_target_language_id, p_target_word_usage_example)
  ON CONFLICT (id) DO UPDATE
  SET text = EXCLUDED.text,
      language_id = EXCLUDED.language_id,
      usage_example = EXCLUDED.usage_example;

  -- Insert or update the translation
  INSERT INTO translation (id, source_word_id, target_word_id)
  VALUES (p_translation_id, p_source_word_id, p_target_word_id)
  ON CONFLICT (id) DO UPDATE
  SET source_word_id = EXCLUDED.source_word_id,
      target_word_id = EXCLUDED.target_word_id;

  -- Insert or update the word list
  INSERT INTO word_list (id, name)
  VALUES (DEFAULT, p_word_list_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_word_list_id;

  -- Insert or update the translation in the word list
  INSERT INTO word_list_entry (translation_id, word_list_id)
  VALUES (p_translation_id, v_word_list_id)
  ON CONFLICT (translation_id, word_list_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_word_pair_and_list_entry (p_translation_id INTEGER) RETURNS VOID AS $$
DECLARE
  v_source_word_id INTEGER;
  v_target_word_id INTEGER;
  v_source_language_id INTEGER;
  v_target_language_id INTEGER;
  v_word_list_id INTEGER;
BEGIN
  -- Get the source and target word IDs
  SELECT source_word_id, target_word_id
  INTO v_source_word_id, v_target_word_id
  FROM translation
  WHERE id = p_translation_id;

  -- Get the language IDs
  SELECT language_id INTO v_source_language_id FROM word WHERE id = v_source_word_id;
  SELECT language_id INTO v_target_language_id FROM word WHERE id = v_target_word_id;

  -- Get the word list ID
  SELECT word_list_id INTO v_word_list_id
  FROM word_list_entry
  WHERE translation_id = p_translation_id;

  -- Delete the word list entry
  DELETE FROM word_list_entry
  WHERE translation_id = p_translation_id;

  -- Delete the translation
  DELETE FROM translation
  WHERE id = p_translation_id;

  -- Delete the source and target words
  DELETE FROM word
  WHERE id IN (v_source_word_id, v_target_word_id);

  -- Delete user translation progress
  DELETE FROM user_translation_progress
  WHERE word_pair_id = p_translation_id;

  -- Remove languages if no words exist for them
  DELETE FROM language
  WHERE id IN (v_source_language_id, v_target_language_id)
    AND NOT EXISTS (SELECT 1 FROM word WHERE language_id = language.id);

  -- Remove word list if no entries exist for it
  DELETE FROM word_list
  WHERE id = v_word_list_id
    AND NOT EXISTS (SELECT 1 FROM word_list_entry WHERE word_list_id = word_list.id);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_word_sets (p_user_id INTEGER, p_word_list_name VARCHAR) RETURNS TABLE (
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