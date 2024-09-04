CREATE
OR REPLACE FUNCTION remove_word_pair_and_list_entry (p_translation_id INTEGER) RETURNS VOID AS $$
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
