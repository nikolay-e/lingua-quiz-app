-- Quiz session tables

-- Drop deprecated tables
DROP TABLE IF EXISTS quiz_session_stats;

-- Migration fixes for existing production tables
-- Fix: Remove array column that conflicts with session history migration
ALTER TABLE IF EXISTS quiz_session DROP COLUMN IF EXISTS last_asked_words;

-- Fix: Add session ownership validation function
CREATE OR REPLACE FUNCTION validate_session_ownership(
    p_session_id INTEGER,
    p_user_id INTEGER
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM quiz_session 
        WHERE id = p_session_id AND user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Fix: Add batch word promotion function to fix N+1 query
CREATE OR REPLACE FUNCTION batch_promote_words_to_level1(
    p_user_id INTEGER,
    p_word_ids INTEGER[]
) RETURNS INTEGER AS $$
DECLARE
    v_promoted_count INTEGER;
BEGIN
    -- Batch insert/update using unnest
    WITH word_promotions AS (
        SELECT p_user_id as user_id, unnest(p_word_ids) as word_pair_id
    )
    INSERT INTO user_translation_progress (user_id, word_pair_id, status)
    SELECT user_id, word_pair_id, 'LEVEL_1'::translation_status
    FROM word_promotions
    ON CONFLICT (user_id, word_pair_id)
    DO UPDATE SET status = 'LEVEL_1', updated_at = CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS v_promoted_count = ROW_COUNT;
    RETURN v_promoted_count;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS quiz_session (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES "user"(id) ON DELETE CASCADE,
    word_list_id INTEGER REFERENCES word_list(id),
    direction BOOLEAN DEFAULT true, -- true = normal, false = reverse
    current_translation_id INTEGER REFERENCES translation(id),
    last_asked_words INTEGER[], -- Array of last N translation IDs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, word_list_id)
);


-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_session_user_list ON quiz_session(user_id, word_list_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_user_updated ON quiz_session(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_quiz_session_current_word ON quiz_session(current_translation_id) WHERE current_translation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quiz_session_user_id_validation ON quiz_session(user_id, id);
CREATE INDEX IF NOT EXISTS idx_user_translation_progress_batch_update ON user_translation_progress(user_id, word_pair_id, status);

-- Function to get candidate words for a given status and word list
CREATE OR REPLACE FUNCTION get_candidate_words(
    p_user_id INTEGER,
    p_word_list_id INTEGER,
    p_status VARCHAR(20)
) RETURNS INTEGER[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT DISTINCT t.id
        FROM word_list_entry wle
        JOIN translation t ON t.id = wle.translation_id
        LEFT JOIN user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
        WHERE wle.word_list_id = p_word_list_id 
        AND (
            (p_status = 'LEVEL_0' AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)) OR
            (utp.status = p_status)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to populate focus words from LEVEL_0 to LEVEL_1
CREATE OR REPLACE FUNCTION populate_focus_words(
    p_user_id INTEGER,
    p_session_id INTEGER,
    p_max_focus_words INTEGER DEFAULT 20
) RETURNS INTEGER AS $$
DECLARE
    v_current_count INTEGER;
    v_spaces_available INTEGER;
    v_words_to_move INTEGER[];
    v_word_id INTEGER;
    v_moved_count INTEGER := 0;
BEGIN
    -- Get current LEVEL_1 count for this word list
    SELECT COUNT(*)
    INTO v_current_count
    FROM user_translation_progress utp
    JOIN word_list_entry wle ON wle.translation_id = utp.word_pair_id
    JOIN quiz_session qs ON qs.word_list_id = wle.word_list_id
    WHERE qs.id = p_session_id
    AND utp.user_id = qs.user_id
    AND utp.status = 'LEVEL_1';
    
    v_spaces_available := p_max_focus_words - v_current_count;
    
    IF v_spaces_available <= 0 THEN
        RETURN 0;
    END IF;
    
    -- Get LEVEL_0 words for this quiz
    SELECT ARRAY(
        SELECT t.id
        FROM quiz_session qs
        JOIN word_list_entry wle ON wle.word_list_id = qs.word_list_id
        JOIN translation t ON t.id = wle.translation_id
        LEFT JOIN user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
        WHERE qs.id = p_session_id AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)
        ORDER BY RANDOM()
        LIMIT v_spaces_available
    ) INTO v_words_to_move;
    
    -- Move words to LEVEL_1
    FOREACH v_word_id IN ARRAY v_words_to_move LOOP
        INSERT INTO user_translation_progress (user_id, word_pair_id, status)
        VALUES (p_user_id, v_word_id, 'LEVEL_1')
        ON CONFLICT (user_id, word_pair_id)
        DO UPDATE SET status = 'LEVEL_1', updated_at = CURRENT_TIMESTAMP;
        
        v_moved_count := v_moved_count + 1;
    END LOOP;
    
    RETURN v_moved_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update last asked words array
CREATE OR REPLACE FUNCTION update_quiz_session_current_word(
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_max_last_asked INTEGER DEFAULT 7
) RETURNS VOID AS $$
BEGIN
    UPDATE quiz_session 
    SET current_translation_id = p_translation_id,
        last_asked_words = (
            COALESCE(last_asked_words, ARRAY[]::INTEGER[]) || ARRAY[p_translation_id]
        )[GREATEST(1, array_length(COALESCE(last_asked_words, ARRAY[]::INTEGER[]), 1) + 2 - p_max_last_asked):],
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check if L2 is empty and switch direction
CREATE OR REPLACE FUNCTION check_and_switch_direction_if_l2_empty(
    p_user_id INTEGER,
    p_session_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_l2_count INTEGER;
    v_word_list_id INTEGER;
BEGIN
    -- Get word list id
    SELECT word_list_id INTO v_word_list_id FROM quiz_session WHERE id = p_session_id;
    
    -- Count L2 words
    SELECT COUNT(*)
    INTO v_l2_count
    FROM word_list_entry wle
    JOIN user_translation_progress utp 
        ON utp.word_pair_id = wle.translation_id 
        AND utp.user_id = p_user_id
    WHERE wle.word_list_id = v_word_list_id AND utp.status = 'LEVEL_2';
    
    -- If L2 is empty, switch to normal direction
    IF v_l2_count = 0 THEN
        UPDATE quiz_session 
        SET direction = true, current_translation_id = NULL
        WHERE id = p_session_id;
        RETURN true;
    END IF;
    
    RETURN false;
END;
$$ LANGUAGE plpgsql;

-- Function to check quiz completion progress
CREATE OR REPLACE FUNCTION get_quiz_completion_status(
    p_user_id INTEGER,
    p_word_list_id INTEGER
) RETURNS JSONB AS $$
DECLARE
    v_total INTEGER;
    v_mastered INTEGER;
BEGIN
    SELECT COUNT(*) as total,
           COUNT(CASE WHEN COALESCE(utp.status, 'LEVEL_0') = 'LEVEL_3' THEN 1 END) as mastered
    INTO v_total, v_mastered
    FROM word_list_entry wle
    LEFT JOIN user_translation_progress utp 
        ON utp.word_pair_id = wle.translation_id 
        AND utp.user_id = p_user_id
    WHERE wle.word_list_id = p_word_list_id;
    
    RETURN jsonb_build_object(
        'total', v_total,
        'mastered', v_mastered,
        'is_complete', v_mastered = v_total AND v_total > 0
    );
END;
$$ LANGUAGE plpgsql;

-- Function to force switch to normal direction
CREATE OR REPLACE FUNCTION force_switch_to_normal_direction(
    p_session_id INTEGER
) RETURNS VOID AS $$
BEGIN
    UPDATE quiz_session 
    SET direction = true
    WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Function to count words by level
CREATE OR REPLACE FUNCTION count_words_by_level(
    p_user_id INTEGER,
    p_word_list_id INTEGER,
    p_level VARCHAR(20)
) RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_count
    FROM word_list_entry wle
    JOIN user_translation_progress utp 
        ON utp.word_pair_id = wle.translation_id 
        AND utp.user_id = p_user_id
    WHERE wle.word_list_id = p_word_list_id AND utp.status = p_level;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Comments for critical fixes
COMMENT ON FUNCTION validate_session_ownership(INTEGER, INTEGER) IS 'Validates that a session belongs to the specified user';
COMMENT ON FUNCTION batch_promote_words_to_level1(INTEGER, INTEGER[]) IS 'Batch promotes words to avoid N+1 query problem';

-- Session constraints (moved from 020_schema_constraints.sql)
-- Add constraint for reasonable quiz session data
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'quiz_session_user_positive'
    ) THEN
        ALTER TABLE quiz_session 
        ADD CONSTRAINT quiz_session_user_positive CHECK (user_id > 0);
    END IF;
END;
$$;

-- Performance index (moved from 020_schema_constraints.sql)
-- Add index for quiz session lookup by user and word list
CREATE INDEX IF NOT EXISTS idx_quiz_session_user_wordlist 
ON quiz_session(user_id, word_list_id) WHERE current_translation_id IS NOT NULL;

-- Session info function (moved from 021_focused_functions.sql)
CREATE OR REPLACE FUNCTION get_session_info(
    p_user_id INTEGER,
    p_word_list_name VARCHAR(255)
) RETURNS TABLE(
    session_id INTEGER,
    word_list_id INTEGER,
    direction BOOLEAN,
    current_word_id INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT qs.id, qs.word_list_id, qs.direction, qs.current_translation_id
    FROM quiz_session qs
    JOIN word_list wl ON wl.id = qs.word_list_id
    WHERE qs.user_id = p_user_id AND wl.name = p_word_list_name;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_session_info(INTEGER, VARCHAR) IS 'Simple session lookup without business logic';

-- Session update function (moved from 021_focused_functions.sql)
-- Fixed: Made atomic to prevent race conditions
CREATE OR REPLACE FUNCTION update_session_current_word(
    p_session_id INTEGER,
    p_translation_id INTEGER
) RETURNS VOID AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    -- Use advisory lock to prevent race conditions
    PERFORM pg_advisory_xact_lock(p_session_id);
    
    -- Update session and get next sequence number atomically
    UPDATE quiz_session 
    SET current_translation_id = p_translation_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = p_session_id;
    
    -- Get next sequence number
    SELECT COALESCE(MAX(sequence_number), 0) + 1 
    INTO v_next_seq
    FROM session_word_history 
    WHERE session_id = p_session_id;
    
    -- Insert new history entry atomically
    INSERT INTO session_word_history (session_id, word_id, sequence_number)
    VALUES (p_session_id, p_translation_id, v_next_seq);
    
    -- Clean old history (keep only last 7 entries) atomically
    DELETE FROM session_word_history 
    WHERE session_id = p_session_id 
    AND sequence_number <= v_next_seq - 7;
    
    -- Advisory lock automatically released at transaction end
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION update_session_current_word(INTEGER, INTEGER) IS 'Updates session state and history';