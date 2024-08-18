CREATE
OR REPLACE FUNCTION update_user_word_set_status (
  p_user_id INTEGER,
  p_word_pair_ids INTEGER[],
  p_status translation_status
) RETURNS VOID AS $$
BEGIN
  -- If the array is empty, remove all words from the given status
  IF p_word_pair_ids IS NULL OR array_length(p_word_pair_ids, 1) = 0 THEN
    DELETE FROM user_translation_progress
    WHERE user_id = p_user_id AND status = p_status;
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

  -- Update or insert progress for the specified word pairs
  INSERT INTO user_translation_progress (user_id, word_pair_id, status, updated_at)
  SELECT p_user_id, wpid, p_status, CURRENT_TIMESTAMP
  FROM unnest(p_word_pair_ids) AS wpid
  ON CONFLICT (user_id, word_pair_id) 
  DO UPDATE SET status = EXCLUDED.status, updated_at = EXCLUDED.updated_at;

  -- Remove progress entries for this status that are not in the provided set
  DELETE FROM user_translation_progress
  WHERE user_id = p_user_id 
    AND status = p_status 
    AND word_pair_id != ALL(p_word_pair_ids);

  -- Ensure disjoint sets by removing conflicting entries in other statuses
  DELETE FROM user_translation_progress
  WHERE user_id = p_user_id 
    AND status != p_status 
    AND word_pair_id = ANY(p_word_pair_ids);
END;
$$ LANGUAGE plpgsql;
