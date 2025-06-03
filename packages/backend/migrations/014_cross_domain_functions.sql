-- Cross-domain functions that span multiple database tables

-- Functions
CREATE OR REPLACE FUNCTION get_available_words(
    p_user_id INTEGER,
    p_word_list_id INTEGER,
    p_level VARCHAR(20),
    p_exclude_words INTEGER[] DEFAULT ARRAY[]::INTEGER[]
) RETURNS INTEGER[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT t.id
        FROM word_list_entry wle
        JOIN translation t ON t.id = wle.translation_id
        LEFT JOIN user_translation_progress utp 
            ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
        WHERE wle.word_list_id = p_word_list_id 
        AND (
            (p_level = 'LEVEL_0' AND (utp.status::TEXT = 'LEVEL_0' OR utp.status IS NULL)) OR
            (utp.status::TEXT = p_level)
        )
        AND (p_exclude_words IS NULL OR array_length(p_exclude_words, 1) IS NULL OR NOT (t.id = ANY(p_exclude_words)))
        ORDER BY RANDOM()
    );
END;
$$ LANGUAGE plpgsql;

-- Simple function to record a quiz answer (just insert, no business logic)
CREATE OR REPLACE FUNCTION record_quiz_answer(
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_direction BOOLEAN,
    p_user_answer TEXT,
    p_correct_answer TEXT,
    p_is_correct BOOLEAN,
    p_response_time_ms INTEGER DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_submission_id INTEGER;
BEGIN
    INSERT INTO quiz_submission_log (
        session_id, translation_id, direction, 
        user_answer, correct_answer, is_correct, 
        response_time_ms, question_word
    ) VALUES (
        p_session_id, p_translation_id, p_direction,
        p_user_answer, p_correct_answer, p_is_correct,
        p_response_time_ms, 
        -- Get the question word based on direction
        (SELECT CASE WHEN p_direction THEN sw.text ELSE tw.text END
         FROM translation t
         JOIN word sw ON t.source_word_id = sw.id
         JOIN word tw ON t.target_word_id = tw.id
         WHERE t.id = p_translation_id)
    ) RETURNING id INTO v_submission_id;
    
    RETURN v_submission_id;
END;
$$ LANGUAGE plpgsql;

-- Simple function to get word statistics (read-only)
CREATE OR REPLACE FUNCTION get_word_statistics(
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_direction BOOLEAN,
    p_recent_attempts INTEGER DEFAULT 10
) RETURNS TABLE(
    total_attempts BIGINT,
    correct_attempts BIGINT,
    recent_attempts BOOLEAN[],
    consecutive_correct INTEGER,
    mistakes_in_recent INTEGER
) AS $$
DECLARE
    v_recent_attempts BOOLEAN[];
BEGIN
    -- Get recent attempts
    SELECT ARRAY(
        SELECT is_correct 
        FROM quiz_submission_log 
        WHERE session_id = p_session_id 
        AND translation_id = p_translation_id 
        AND direction = p_direction
        ORDER BY submitted_at DESC
        LIMIT p_recent_attempts
    ) INTO v_recent_attempts;
    
    RETURN QUERY
    SELECT 
        COUNT(*) as total_attempts,
        COUNT(*) FILTER (WHERE is_correct) as correct_attempts,
        v_recent_attempts as recent_attempts,
        util_count_consecutive_correct(v_recent_attempts) as consecutive_correct,
        util_count_mistakes_in_array(v_recent_attempts) as mistakes_in_recent
    FROM quiz_submission_log
    WHERE session_id = p_session_id 
    AND translation_id = p_translation_id 
    AND direction = p_direction;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_word_display_info(
    p_translation_id INTEGER
) RETURNS TABLE(
    translation_id INTEGER,
    source_word TEXT,
    target_word TEXT,
    source_language TEXT,
    target_language TEXT,
    source_example TEXT,
    target_example TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        util_clean_pipe_alternatives(sw.text),
        util_clean_pipe_alternatives(tw.text),
        sl.name::TEXT,
        tl.name::TEXT,
        sw.usage_example,
        tw.usage_example
    FROM translation t
    JOIN word sw ON t.source_word_id = sw.id
    JOIN word tw ON t.target_word_id = tw.id
    JOIN language sl ON sw.language_id = sl.id
    JOIN language tl ON tw.language_id = tl.id
    WHERE t.id = p_translation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to count words by level (simple and focused)
CREATE OR REPLACE FUNCTION count_user_words_by_level(
    p_user_id INTEGER,
    p_word_list_id INTEGER
) RETURNS TABLE(
    level_0_count BIGINT,
    level_1_count BIGINT,
    level_2_count BIGINT,
    level_3_count BIGINT,
    total_words BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) FILTER (WHERE COALESCE(utp.status::TEXT, 'LEVEL_0') = 'LEVEL_0') as level_0_count,
        COUNT(*) FILTER (WHERE utp.status::TEXT = 'LEVEL_1') as level_1_count,
        COUNT(*) FILTER (WHERE utp.status::TEXT = 'LEVEL_2') as level_2_count,
        COUNT(*) FILTER (WHERE utp.status::TEXT = 'LEVEL_3') as level_3_count,
        COUNT(*) as total_words
    FROM word_list_entry wle
    LEFT JOIN user_translation_progress utp 
        ON utp.word_pair_id = wle.translation_id 
        AND utp.user_id = p_user_id
    WHERE wle.word_list_id = p_word_list_id;
END;
$$ LANGUAGE plpgsql;

-- Word pair management functions (from origin main files 008, 009, 010, 011)
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

