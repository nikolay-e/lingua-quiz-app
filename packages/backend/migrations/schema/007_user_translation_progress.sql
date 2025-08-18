-- User translation progress table
CREATE TABLE IF NOT EXISTS user_translation_progress (
    user_id INTEGER REFERENCES users (id) ON DELETE CASCADE,
    word_pair_id INTEGER REFERENCES translations (id) ON DELETE CASCADE,
    status TRANSLATION_STATUS NOT NULL,
    queue_position INTEGER DEFAULT 0,
    PRIMARY KEY (user_id, word_pair_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user
ON user_translation_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_word_pair
ON user_translation_progress (word_pair_id);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user_status
ON user_translation_progress (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_word_pair_status
ON user_translation_progress (word_pair_id, status);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user_queue
ON user_translation_progress (user_id, status, queue_position);

-- Functions
CREATE OR REPLACE FUNCTION update_user_word_set_status(
    p_user_id INTEGER,
    p_word_pair_ids INTEGER [],
    p_status TRANSLATION_STATUS
) RETURNS VOID AS $$
DECLARE
  v_word_pair_id INTEGER;
BEGIN
  -- If the array is null or empty, just return without doing anything
  IF p_word_pair_ids IS NULL OR array_length(p_word_pair_ids, 1) IS NULL OR array_length(p_word_pair_ids, 1) = 0 THEN
    RETURN;
  END IF;

  -- Validate all word pair IDs exist
  IF EXISTS (
    SELECT 1
    FROM unnest(p_word_pair_ids) AS wpid
    LEFT JOIN translations t ON t.id = wpid
    WHERE t.id IS NULL
  ) THEN
    RAISE EXCEPTION 'One or more word pair IDs do not exist in the translations table';
  END IF;

  -- Update status for each word pair using array index as queue position
  IF array_length(p_word_pair_ids, 1) IS NOT NULL THEN
    FOR i IN 1..array_length(p_word_pair_ids, 1)
    LOOP
      -- Insert or update progress for the word pair with queue position
      INSERT INTO user_translation_progress (user_id, word_pair_id, status, queue_position)
      VALUES (p_user_id, p_word_pair_ids[i], p_status, i - 1)  -- 0-based indexing
      ON CONFLICT (user_id, word_pair_id)
      DO UPDATE SET status = EXCLUDED.status, queue_position = EXCLUDED.queue_position;
    END LOOP;
  END IF;
END;
$$ LANGUAGE plpgsql;
