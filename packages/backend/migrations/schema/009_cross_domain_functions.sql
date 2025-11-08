CREATE OR REPLACE FUNCTION insert_word_pair_and_add_to_list(
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
  INSERT INTO languages (id, name)
  VALUES (DEFAULT, p_source_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_source_language_id;

  INSERT INTO languages (id, name)
  VALUES (DEFAULT, p_target_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_target_language_id;

  INSERT INTO words (id, text, language_id, usage_example)
  VALUES (p_source_word_id, p_source_word, v_source_language_id, p_source_word_usage_example)
  ON CONFLICT (id) DO UPDATE
  SET text = EXCLUDED.text,
      language_id = EXCLUDED.language_id,
      usage_example = EXCLUDED.usage_example;

  INSERT INTO words (id, text, language_id, usage_example)
  VALUES (p_target_word_id, p_target_word, v_target_language_id, p_target_word_usage_example)
  ON CONFLICT (id) DO UPDATE
  SET text = EXCLUDED.text,
      language_id = EXCLUDED.language_id,
      usage_example = EXCLUDED.usage_example;

  INSERT INTO translations (id, source_word_id, target_word_id)
  VALUES (p_translation_id, p_source_word_id, p_target_word_id)
  ON CONFLICT (id) DO UPDATE
  SET source_word_id = EXCLUDED.source_word_id,
      target_word_id = EXCLUDED.target_word_id;

  INSERT INTO word_lists (id, name)
  VALUES (DEFAULT, p_word_list_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_word_list_id;

  INSERT INTO word_list_entries (translation_id, word_list_id)
  VALUES (p_translation_id, v_word_list_id)
  ON CONFLICT (translation_id, word_list_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION remove_word_pair_and_list_entry(
    p_translation_id INTEGER
) RETURNS VOID AS $$
DECLARE
  v_source_word_id INTEGER;
  v_target_word_id INTEGER;
  v_source_language_id INTEGER;
  v_target_language_id INTEGER;
  v_word_list_id INTEGER;
BEGIN
  SELECT source_word_id, target_word_id
  INTO v_source_word_id, v_target_word_id
  FROM translations
  WHERE id = p_translation_id;

  SELECT language_id INTO v_source_language_id FROM words WHERE id = v_source_word_id;
  SELECT language_id INTO v_target_language_id FROM words WHERE id = v_target_word_id;

  SELECT word_list_id INTO v_word_list_id
  FROM word_list_entries
  WHERE translation_id = p_translation_id;

  DELETE FROM user_translation_progress
  WHERE word_pair_id = p_translation_id;

  DELETE FROM word_list_entries
  WHERE translation_id = p_translation_id;

  DELETE FROM translations
  WHERE id = p_translation_id;

  DELETE FROM words
  WHERE id = v_source_word_id
    AND NOT EXISTS (SELECT 1 FROM translations WHERE source_word_id = v_source_word_id OR target_word_id = v_source_word_id);

  DELETE FROM words
  WHERE id = v_target_word_id
    AND NOT EXISTS (SELECT 1 FROM translations WHERE source_word_id = v_target_word_id OR target_word_id = v_target_word_id);

  DELETE FROM languages
  WHERE id IN (v_source_language_id, v_target_language_id)
    AND NOT EXISTS (SELECT 1 FROM words WHERE language_id = languages.id);

  DELETE FROM word_lists
  WHERE id = v_word_list_id
    AND NOT EXISTS (SELECT 1 FROM word_list_entries WHERE word_list_id = word_lists.id);
END;
$$ LANGUAGE plpgsql;

DROP FUNCTION IF EXISTS get_user_word_sets(INTEGER, VARCHAR);

CREATE OR REPLACE FUNCTION get_user_word_sets(
    p_user_id INTEGER, p_word_list_name VARCHAR
) RETURNS TABLE (
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
      tw.usage_example AS target_word_usage_example,
      COALESCE(utp.queue_position, 0) AS queue_position
    FROM
      word_list_entries wle
    JOIN
      translations t ON wle.translation_id = t.id
    JOIN
      words sw ON t.source_word_id = sw.id
    JOIN
      words tw ON t.target_word_id = tw.id
    JOIN
      languages sl ON sw.language_id = sl.id
    JOIN
      languages tl ON tw.language_id = tl.id
    JOIN
      word_lists wl ON wle.word_list_id = wl.id
    LEFT JOIN
      user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
    WHERE
      wl.name = p_word_list_name
  )
  SELECT
    user_words.word_pair_id,
    user_words.status,
    user_words.source_word,
    user_words.target_word,
    user_words.source_language,
    user_words.target_language,
    user_words.source_word_usage_example,
    user_words.target_word_usage_example
  FROM user_words
  ORDER BY
    CASE
      WHEN user_words.status = 'LEVEL_1' THEN 1
      WHEN user_words.status = 'LEVEL_0' THEN 2
      WHEN user_words.status = 'LEVEL_2' THEN 3
      WHEN user_words.status = 'LEVEL_3' THEN 4
      WHEN user_words.status = 'LEVEL_4' THEN 5
      WHEN user_words.status = 'LEVEL_5' THEN 6
      ELSE 7
    END,
    user_words.queue_position,
    user_words.word_pair_id;
END;
$$ LANGUAGE plpgsql;
