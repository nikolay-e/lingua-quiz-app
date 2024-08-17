CREATE
OR REPLACE FUNCTION insert_word_and_translation (
  p_word VARCHAR(255),
  p_translation VARCHAR(255),
  p_language_code VARCHAR(10),
  p_translation_language_code VARCHAR(10),
  p_word_list_name VARCHAR(255),
  p_usage_example TEXT DEFAULT NULL,
  p_translation_usage_example TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_word_id INTEGER;
    v_translation_id INTEGER;
    v_word_list_id INTEGER;
BEGIN
    -- Insert the language of the word if it doesn't exist
    INSERT INTO languages (code)
    VALUES (p_language_code)
    ON CONFLICT (code) DO NOTHING;
    
    -- Insert the language of the translation if it doesn't exist
    INSERT INTO languages (code)
    VALUES (p_translation_language_code)
    ON CONFLICT (code) DO NOTHING;

    -- Insert the word into the words table
    INSERT INTO words (word, language_code, usage_example)
    VALUES (p_word, p_language_code, p_usage_example)
    ON CONFLICT (word, language_code) DO NOTHING
    RETURNING id INTO v_word_id;
    
    -- If the word already exists, get its id
    IF v_word_id IS NULL THEN
        SELECT id INTO v_word_id FROM words WHERE word = p_word AND language_code = p_language_code;
    END IF;

    -- Insert the translation into the words table
    INSERT INTO words (word, language_code, usage_example)
    VALUES (p_translation, p_translation_language_code, p_translation_usage_example)
    ON CONFLICT (word, language_code) DO NOTHING
    RETURNING id INTO v_translation_id;
    
    -- If the translation already exists, get its id
    IF v_translation_id IS NULL THEN
        SELECT id INTO v_translation_id FROM words WHERE word = p_translation AND language_code = p_translation_language_code;
    END IF;

    -- Insert the translation relationship into the translations table
    INSERT INTO translations (word_id, translation_id)
    VALUES (v_word_id, v_translation_id)
    ON CONFLICT (word_id, translation_id) DO NOTHING;

    -- Insert the word list if it doesn't exist
    INSERT INTO word_lists (name)
    VALUES (p_word_list_name)
    ON CONFLICT (name) DO NOTHING
    RETURNING id INTO v_word_list_id;

    -- If the word list already exists, get its id
    IF v_word_list_id IS NULL THEN
        SELECT id INTO v_word_list_id FROM word_lists WHERE name = p_word_list_name;
    END IF;

    -- Insert the word into the word list
    INSERT INTO word_list_items (word_id, word_list_id)
    VALUES (v_word_id, v_word_list_id)
    ON CONFLICT (word_id, word_list_id) DO NOTHING;

    -- Insert the translation into the word list
    INSERT INTO word_list_items (word_id, word_list_id)
    VALUES (v_translation_id, v_word_list_id)
    ON CONFLICT (word_id, word_list_id) DO NOTHING;

END;
$$ LANGUAGE plpgsql;
