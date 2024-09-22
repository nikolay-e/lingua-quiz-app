CREATE
OR REPLACE FUNCTION insert_word_pair_and_add_to_list (
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
  INSERT INTO language (name)
  VALUES (p_source_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_source_language_id;
  
  -- Insert or update the target language
  INSERT INTO language (name)
  VALUES (p_target_language_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_target_language_id;

  -- Insert or update the source word
  INSERT INTO word (id, text, language_id, usage_example)
  VALUES (p_source_word_id, p_source_word, v_source_language_id, p_source_word_usage_example)
  ON CONFLICT (id) DO UPDATE 
  SET text = EXCLUDED.text, 
      language_id = EXCLUDED.language_id, 
      usage_example = EXCLUDED.usage_example;

  -- Insert or update the target word
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
  INSERT INTO word_list (name)
  VALUES (p_word_list_name)
  ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
  RETURNING id INTO v_word_list_id;

  -- Insert or update the translation in the word list
  INSERT INTO word_list_entry (translation_id, word_list_id)
  VALUES (p_translation_id, v_word_list_id)
  ON CONFLICT (translation_id, word_list_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;
