CREATE
OR REPLACE FUNCTION update_user_word_set_status (
  p_user_id INTEGER,
  p_word_pair_ids INTEGER[],
  p_status translation_status
) RETURNS VOID AS $$
DECLARE
  v_current_status translation_status;
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

  -- Check and update status for each word pair
  FOREACH v_word_pair_id IN ARRAY p_word_pair_ids
  LOOP
    -- Get the current status
    SELECT status INTO v_current_status
    FROM user_translation_progress
    WHERE user_id = p_user_id AND word_pair_id = v_word_pair_id;

    -- If no current status exists, treat it as 'Upcoming Words'
    IF v_current_status IS NULL THEN
      v_current_status := 'Upcoming Words'::translation_status;
    END IF;

    -- Check if the transition is valid
    IF (v_current_status = 'Upcoming Words' AND p_status = 'Focus Words') OR
       (v_current_status = 'Focus Words' AND p_status = 'Mastered One Direction') OR
       (v_current_status = 'Mastered One Direction' AND p_status = 'Mastered Vocabulary') OR
       (v_current_status = 'Mastered Vocabulary' AND p_status = 'Upcoming Words') OR
       (v_current_status = 'Upcoming Words' AND p_status = 'Upcoming Words') OR
       (v_current_status = p_status) THEN
      -- Insert or update progress for the word pair
      INSERT INTO user_translation_progress (user_id, word_pair_id, status, updated_at)
      VALUES (p_user_id, v_word_pair_id, p_status, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, word_pair_id)
      DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;
    ELSE
      RAISE EXCEPTION 'Invalid status transition from % to %', v_current_status, p_status;
    END IF;
  END LOOP;

  -- Remove progress entries for this status that are not in the provided set
  DELETE FROM user_translation_progress
  WHERE user_id = p_user_id
    AND status = p_status
    AND word_pair_id != ALL(p_word_pair_ids);
END;
$$ LANGUAGE plpgsql;
