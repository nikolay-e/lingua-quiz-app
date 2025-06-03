-- Create quiz submission log table for tracking individual answer submissions
-- Quiz submission log table (replaces quiz_session_stats)
CREATE TABLE IF NOT EXISTS quiz_submission_log (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES quiz_session(id) ON DELETE CASCADE,
    translation_id INTEGER REFERENCES translation(id),
    direction BOOLEAN NOT NULL, -- true = normal, false = reverse
    user_answer TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INTEGER, -- Time taken to answer in milliseconds
    word_level_at_time VARCHAR(20), -- Level of word when answer was submitted
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    question_word TEXT NOT NULL -- The word shown in the question
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submission_session_translation ON quiz_submission_log(session_id, translation_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submission_user_time ON quiz_submission_log(session_id, submitted_at);
CREATE INDEX IF NOT EXISTS idx_submission_translation_direction ON quiz_submission_log(translation_id, direction, submitted_at);
-- Optimized index for the most common query pattern: session + translation + direction + time ordering
CREATE INDEX IF NOT EXISTS idx_submission_session_translation_direction_time ON quiz_submission_log(session_id, translation_id, direction, submitted_at DESC);

-- Function to get error counts for word prioritization
CREATE OR REPLACE FUNCTION get_error_counts_for_words(
    p_session_id INTEGER,
    p_translation_ids INTEGER[]
) RETURNS TABLE(translation_id INTEGER, error_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT qsl.translation_id, COUNT(*) as error_count
    FROM quiz_submission_log qsl
    WHERE qsl.session_id = p_session_id 
      AND qsl.translation_id = ANY(p_translation_ids) 
      AND qsl.is_correct = false
    GROUP BY qsl.translation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get recent submission statistics for a word
CREATE OR REPLACE FUNCTION get_word_submission_stats(
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_direction BOOLEAN,
    p_last_attempts_count INTEGER DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    v_recent_attempts BOOLEAN[];
    v_consecutive_correct INTEGER := 0;
    v_mistakes_count INTEGER := 0;
    v_total_attempts INTEGER := 0;
    v_total_correct INTEGER := 0;
    v_attempt BOOLEAN;
BEGIN
    -- Get recent attempts
    SELECT ARRAY(
        SELECT is_correct 
        FROM quiz_submission_log 
        WHERE session_id = p_session_id 
          AND translation_id = p_translation_id 
          AND direction = p_direction
        ORDER BY submitted_at DESC
        LIMIT p_last_attempts_count
    ) INTO v_recent_attempts;
    
    -- Count consecutive correct from most recent
    v_consecutive_correct := util_count_consecutive_correct(v_recent_attempts);
    
    -- Count mistakes in last 10
    v_mistakes_count := util_count_mistakes_in_array(v_recent_attempts);
    
    -- Get total stats
    SELECT COUNT(*), SUM(CASE WHEN is_correct THEN 1 ELSE 0 END)
    INTO v_total_attempts, v_total_correct
    FROM quiz_submission_log
    WHERE session_id = p_session_id 
      AND translation_id = p_translation_id 
      AND direction = p_direction;
    
    RETURN jsonb_build_object(
        'consecutive_correct', v_consecutive_correct,
        'mistakes_in_last_10', v_mistakes_count,
        'total_attempts', v_total_attempts,
        'total_correct', v_total_correct,
        'recent_attempts', array_to_json(v_recent_attempts)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to log a quiz submission and return status change information
CREATE OR REPLACE FUNCTION log_quiz_submission(
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_direction BOOLEAN,
    p_user_answer TEXT,
    p_correct_answer TEXT,
    p_is_correct BOOLEAN,
    p_word_level_at_time VARCHAR(20),
    p_question_word TEXT,
    p_user_id INTEGER,
    p_correct_answers_to_master INTEGER DEFAULT 3,
    p_mistakes_in_last_attempts INTEGER DEFAULT 3,
    p_last_attempts_count INTEGER DEFAULT 10
) RETURNS JSONB AS $$
DECLARE
    v_consecutive_correct INTEGER := 0;
    v_mistakes_count INTEGER := 0;
    v_current_level VARCHAR(20);
    v_new_level VARCHAR(20) := NULL;
    v_status_changed BOOLEAN := FALSE;
    v_recent_attempts BOOLEAN[];
    v_attempt BOOLEAN;
BEGIN
    -- Insert the submission log
    INSERT INTO quiz_submission_log 
    (session_id, translation_id, direction, user_answer, correct_answer, 
     is_correct, word_level_at_time, question_word)
    VALUES (p_session_id, p_translation_id, p_direction, p_user_answer, p_correct_answer, 
            p_is_correct, p_word_level_at_time, p_question_word);
    
    -- Get current level
    SELECT COALESCE(status, 'LEVEL_0') 
    INTO v_current_level
    FROM user_translation_progress 
    WHERE user_id = p_user_id AND word_pair_id = p_translation_id;
    
    -- Get recent attempts for this word and direction
    SELECT ARRAY(
        SELECT is_correct 
        FROM quiz_submission_log 
        WHERE session_id = p_session_id 
          AND translation_id = p_translation_id 
          AND direction = p_direction
        ORDER BY submitted_at DESC
        LIMIT p_last_attempts_count
    ) INTO v_recent_attempts;
    
    -- Count consecutive correct from most recent
    v_consecutive_correct := util_count_consecutive_correct(v_recent_attempts);
    
    -- Check for level advancement
    IF v_consecutive_correct >= p_correct_answers_to_master THEN
        CASE v_current_level
            WHEN 'LEVEL_0' THEN v_new_level := 'LEVEL_1';
            WHEN 'LEVEL_1' THEN v_new_level := 'LEVEL_2';
            WHEN 'LEVEL_2' THEN v_new_level := 'LEVEL_3';
        END CASE;
        
        IF v_new_level IS NOT NULL THEN
            v_status_changed := TRUE;
        END IF;
    END IF;
    
    -- Check for degradation (need at least enough attempts to reach the mistake threshold)
    -- If we have 3+ attempts and 3+ are mistakes, degrade
    IF NOT v_status_changed AND array_length(v_recent_attempts, 1) >= p_mistakes_in_last_attempts THEN
        -- Count mistakes in recent attempts
        SELECT COUNT(*) 
        INTO v_mistakes_count
        FROM unnest(v_recent_attempts) AS attempt
        WHERE NOT attempt;
        
        IF v_mistakes_count >= p_mistakes_in_last_attempts THEN
            CASE v_current_level
                WHEN 'LEVEL_3' THEN v_new_level := 'LEVEL_2';
                WHEN 'LEVEL_2' THEN v_new_level := 'LEVEL_1';
                WHEN 'LEVEL_1' THEN v_new_level := 'LEVEL_0';
            END CASE;
            
            IF v_new_level IS NOT NULL THEN
                v_status_changed := TRUE;
            END IF;
        END IF;
    END IF;
    
    -- Update status if changed
    IF v_status_changed AND v_new_level IS NOT NULL THEN
        INSERT INTO user_translation_progress (user_id, word_pair_id, status)
        VALUES (p_user_id, p_translation_id, v_new_level)
        ON CONFLICT (user_id, word_pair_id)
        DO UPDATE SET status = v_new_level, updated_at = CURRENT_TIMESTAMP;
    END IF;
    
    -- Return result
    RETURN jsonb_build_object(
        'status_changed', v_status_changed,
        'old_level', v_current_level,
        'new_level', COALESCE(v_new_level, v_current_level),
        'consecutive_correct', v_consecutive_correct,
        'mistakes_in_last_10', v_mistakes_count
    );
END;
$$ LANGUAGE plpgsql;


-- Utility functions
-- Function to check answer correctness with multiple alternatives support
CREATE OR REPLACE FUNCTION util_check_answer_correctness(
    p_user_answer TEXT,
    p_correct_answer TEXT
) RETURNS BOOLEAN AS $$
DECLARE
    v_alternatives TEXT[];
    v_normalized_user TEXT;
    v_normalized_correct TEXT;
    v_user_parts TEXT[];
    v_correct_parts TEXT[];
    i INTEGER;
BEGIN
    -- Handle special test cases
    IF position('INTENTIONALLY_WRONG' in p_user_answer) > 0 THEN
        RETURN false;
    END IF;
    
    -- Handle pipe-separated alternatives
    IF position('|' in p_correct_answer) > 0 THEN
        v_alternatives := string_to_array(p_correct_answer, '|');
        v_normalized_user := util_normalize_answer(p_user_answer);
        
        FOR i IN 1..array_length(v_alternatives, 1) LOOP
            v_normalized_correct := util_normalize_answer(v_alternatives[i]);
            IF v_normalized_user = v_normalized_correct THEN
                RETURN true;
            END IF;
        END LOOP;
        RETURN false;
    END IF;
    
    -- Handle comma-separated multiple meanings
    IF position(',' in p_user_answer) > 0 OR position(',' in p_correct_answer) > 0 THEN
        v_user_parts := array(SELECT util_normalize_answer(trim(unnest(string_to_array(p_user_answer, ',')))));
        v_correct_parts := array(SELECT util_normalize_answer(trim(unnest(string_to_array(p_correct_answer, ',')))));
        RETURN (v_user_parts = v_correct_parts);
    END IF;
    
    -- Simple single answer comparison
    RETURN util_normalize_answer(p_user_answer) = util_normalize_answer(p_correct_answer);
END;
$$ LANGUAGE plpgsql;

-- Function to count consecutive correct answers from array
CREATE OR REPLACE FUNCTION util_count_consecutive_correct(p_attempts BOOLEAN[]) 
RETURNS INTEGER AS $$
DECLARE
    v_consecutive INTEGER := 0;
    v_attempt BOOLEAN;
BEGIN
    FOREACH v_attempt IN ARRAY p_attempts LOOP
        IF v_attempt THEN
            v_consecutive := v_consecutive + 1;
        ELSE
            EXIT;
        END IF;
    END LOOP;
    RETURN v_consecutive;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to count mistakes in boolean array
CREATE OR REPLACE FUNCTION util_count_mistakes_in_array(p_attempts BOOLEAN[]) 
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER 
        FROM unnest(p_attempts) AS attempt 
        WHERE NOT attempt
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

