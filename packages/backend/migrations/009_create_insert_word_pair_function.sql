CREATE
OR REPLACE FUNCTION insert_word_pair_and_add_to_list (
  p_word VARCHAR(255),
  p_translation VARCHAR(255),
  p_source_language_id VARCHAR(10),
  p_target_language_id VARCHAR(10),
  p_word_list_name VARCHAR(255),
  p_word_usage_example TEXT DEFAULT NULL,
  p_translation_usage_example TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_source_word_id INTEGER;
  v_target_word_id INTEGER;
  v_word_list_id INTEGER;
BEGIN
  -- Insert the source language if it doesn't exist
  INSERT INTO language (id, name)
  VALUES (p_source_language_id, 'Unknown') -- Replace 'Unknown' with actual language name
  ON CONFLICT (id) DO NOTHING;
  
  -- Insert the target language if it doesn't exist
  INSERT INTO language (id, name)
  VALUES (p_target_language_id, 'Unknown') -- Replace 'Unknown' with actual language name
  ON CONFLICT (id) DO NOTHING;

  -- Insert the source word into the word table
  INSERT INTO word (text, language_id, usage_example)
  VALUES (p_word, p_source_language_id, p_word_usage_example)
  ON CONFLICT (text, language_id) DO UPDATE SET usage_example = COALESCE(word.usage_example, EXCLUDED.usage_example)
  RETURNING id INTO v_source_word_id;

  -- Insert the translation into the word table
  INSERT INTO word (text, language_id, usage_example)
  VALUES (p_translation, p_target_language_id, p_translation_usage_example)
  ON CONFLICT (text, language_id) DO UPDATE SET usage_example = COALESCE(word.usage_example, EXCLUDED.usage_example)
  RETURNING id INTO v_target_word_id;

  -- Insert the translation relationship into the translations table
  INSERT INTO translation (source_word_id, target_word_id)
  VALUES (v_source_word_id, v_target_word_id)
  ON CONFLICT (source_word_id, target_word_id) DO NOTHING;

  -- Insert the word list if it doesn't exist
  INSERT INTO word_list (name)
  VALUES (p_word_list_name)
  ON CONFLICT (name) DO NOTHING
  RETURNING id INTO v_word_list_id;

  -- If the word list already exists, get its id
  IF v_word_list_id IS NULL THEN
    SELECT id INTO v_word_list_id FROM word_list WHERE name = p_word_list_name;
  END IF;

  -- Insert the source word into the word list
  INSERT INTO word_list_entry (word_id, word_list_id)
  VALUES (v_source_word_id, v_word_list_id)
  ON CONFLICT (word_id, word_list_id) DO NOTHING;

  -- Insert the translation into the word list
  INSERT INTO word_list_entry (word_id, word_list_id)
  VALUES (v_target_word_id, v_word_list_id)
  ON CONFLICT (word_id, word_list_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;
