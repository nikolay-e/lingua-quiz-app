CREATE
OR REPLACE FUNCTION update_user_word_set_status (
  p_user_id INTEGER,
  p_word_pair_ids INTEGER[],
  p_status translation_status
) RETURNS VOID AS $$
DECLARE
  v_word_pair_id INTEGER;
BEGIN
  -- If the array is null, just return without doing anything
  IF p_word_pair_ids IS NULL THEN
    RETURN;
  END IF;

  -- Validate all word pair IDs exist
  IF EXISTS (
    SELECT 1
    FROM unnest(p_word_pair_ids) AS wpid
    LEFT JOIN translation t ON t.id = wpid
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more word pair IDs do not exist in the translations table';
  END IF;

  -- Update status for each word pair
  FOREACH v_word_pair_id IN ARRAY p_word_pair_ids
  LOOP
    -- Insert or update progress for the word pair
    INSERT INTO user_translation_progress (user_id, word_pair_id, status, updated_at)
    VALUES (p_user_id, v_word_pair_id, p_status, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id, word_pair_id)
    DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
