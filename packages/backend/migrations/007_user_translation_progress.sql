-- User translation progress table
CREATE TABLE IF NOT EXISTS user_translation_progress (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES "user" (id) ON DELETE CASCADE,
  word_pair_id INTEGER REFERENCES translation (id) ON DELETE CASCADE,
  status translation_status NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, word_pair_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user ON user_translation_progress (user_id);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_word_pair ON user_translation_progress (word_pair_id);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user_status ON user_translation_progress (user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_word_pair_status ON user_translation_progress (word_pair_id, status);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_user_updated ON user_translation_progress(user_id, updated_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION update_user_word_level(
    p_user_id INTEGER,
    p_translation_id INTEGER,
    p_new_level VARCHAR(20)
) RETURNS BOOLEAN AS $$
DECLARE
    v_row_count INTEGER;
BEGIN
    INSERT INTO user_translation_progress (user_id, word_pair_id, status)
    VALUES (p_user_id, p_translation_id, p_new_level::translation_status)
    ON CONFLICT (user_id, word_pair_id)
    DO UPDATE SET 
        status = p_new_level::translation_status, 
        updated_at = CURRENT_TIMESTAMP
    WHERE user_translation_progress.status::TEXT != p_new_level;
    
    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    RETURN v_row_count > 0;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_user_word_set_status (
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
