-- High-level quiz orchestration functions
-- These functions coordinate multiple systems (sessions, words, submissions, progression)
CREATE OR REPLACE FUNCTION get_next_quiz_question(
    p_user_id INTEGER,
    p_word_list_name VARCHAR(255)
) RETURNS TABLE(
    word_id INTEGER,
    displayed_word TEXT,
    direction BOOLEAN,
    source_language TEXT,
    target_language TEXT,
    session_id INTEGER
) AS $$
DECLARE
    v_session_info RECORD;
    v_candidates INTEGER[];
    v_recently_asked INTEGER[];
    v_selected_word INTEGER;
BEGIN
    -- Get session info
    SELECT * INTO v_session_info
    FROM get_session_info(p_user_id, p_word_list_name);
    
    IF v_session_info.session_id IS NULL THEN
        RETURN; -- No session found
    END IF;
    
    -- Get recently asked words to exclude
    v_recently_asked := get_recently_asked_words(v_session_info.session_id);
    
    -- Get candidates based on direction
    IF v_session_info.direction THEN -- Normal direction (true)
        v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_1', v_recently_asked);
        -- Fallback to LEVEL_2 if no LEVEL_1 words
        IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
            v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_2', v_recently_asked);
        END IF;
    ELSE -- Reverse direction
        v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_2', v_recently_asked);
        -- Fallback to LEVEL_1 if no LEVEL_2 words
        IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
            v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_1', v_recently_asked);
        END IF;
    END IF;
    
    -- If still no candidates, allow recently asked ones
    IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
        IF v_session_info.direction THEN
            v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_1', ARRAY[]::INTEGER[]);
            IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
                v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_2', ARRAY[]::INTEGER[]);
            END IF;
        ELSE
            v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_2', ARRAY[]::INTEGER[]);
            IF array_length(v_candidates, 1) IS NULL OR array_length(v_candidates, 1) = 0 THEN
                v_candidates := get_available_words(p_user_id, v_session_info.word_list_id, 'LEVEL_1', ARRAY[]::INTEGER[]);
            END IF;
        END IF;
    END IF;
    
    -- Select word with error-based prioritization
    WITH error_priority AS (
        SELECT 
            unnest(v_candidates) as candidate_id,
            COALESCE(error_count, 0) as errors
        FROM unnest(v_candidates) as candidate_id
        LEFT JOIN (
            SELECT translation_id, count(*) as error_count
            FROM quiz_submission_log qsl
            WHERE qsl.session_id = v_session_info.session_id 
            AND qsl.translation_id = ANY(v_candidates)
            AND qsl.is_correct = false
            GROUP BY translation_id
        ) ec ON ec.translation_id = candidate_id
    )
    SELECT candidate_id INTO v_selected_word
    FROM error_priority
    ORDER BY errors ASC, random()
    LIMIT 1;
    
    -- Return if no word found
    IF v_selected_word IS NULL THEN
        RETURN;
    END IF;
    
    -- Update session with selected word
    PERFORM update_session_current_word(v_session_info.session_id, v_selected_word);
    
    -- Return word info
    RETURN QUERY
    SELECT 
        wd.translation_id,
        CASE WHEN v_session_info.direction THEN wd.source_word ELSE wd.target_word END,
        v_session_info.direction,
        wd.source_language,
        wd.target_language,
        v_session_info.session_id
    FROM get_word_display_info(v_selected_word) wd;
END;
$$ LANGUAGE plpgsql;

-- Simplified answer processing (just validation and recording)
CREATE OR REPLACE FUNCTION process_quiz_answer(
    p_user_id INTEGER,
    p_session_id INTEGER,
    p_translation_id INTEGER,
    p_user_answer TEXT,
    p_displayed_word TEXT DEFAULT NULL
) RETURNS TABLE(
    is_correct BOOLEAN,
    correct_answer TEXT,
    submission_id INTEGER,
    source_word TEXT,
    target_word TEXT,
    source_example TEXT,
    target_example TEXT
) AS $$
DECLARE
    v_word_info RECORD;
    v_direction BOOLEAN;
    v_correct_answer TEXT;
    v_is_correct BOOLEAN;
    v_submission_id INTEGER;
BEGIN
    -- Get session direction
    SELECT direction
    INTO v_direction
    FROM quiz_session 
    WHERE id = p_session_id AND user_id = p_user_id;
    
    IF v_direction IS NULL THEN
        RETURN; -- Invalid session
    END IF;
    
    -- Get word information
    SELECT * INTO v_word_info
    FROM get_word_display_info(p_translation_id);
    
    -- Validate displayed word if provided
    IF p_displayed_word IS NOT NULL THEN
        DECLARE
            v_expected_word TEXT;
        BEGIN
            IF v_direction THEN
                v_expected_word := v_word_info.source_word;
            ELSE
                v_expected_word := v_word_info.target_word;
            END IF;
            
            IF p_displayed_word != v_expected_word THEN
                RETURN; -- Session out of sync
            END IF;
        END;
    END IF;
    
    -- Determine correct answer
    v_correct_answer := CASE WHEN v_direction 
                             THEN v_word_info.target_word 
                             ELSE v_word_info.source_word END;
    
    -- Check answer correctness
    v_is_correct := util_check_answer_correctness(p_user_answer, v_correct_answer);
    
    -- Record the answer
    v_submission_id := record_quiz_answer(
        p_session_id, p_translation_id, v_direction,
        p_user_answer, v_correct_answer, v_is_correct
    );
    
    -- Return results
    RETURN QUERY
    SELECT 
        v_is_correct,
        v_correct_answer,
        v_submission_id,
        v_word_info.source_word,
        v_word_info.target_word,
        v_word_info.source_example,
        v_word_info.target_example;
END;
$$ LANGUAGE plpgsql;

-- Function to check level progression rules (business logic extracted)
CREATE OR REPLACE FUNCTION check_level_progression(
    p_user_id INTEGER,
    p_translation_id INTEGER,
    p_session_id INTEGER,
    p_direction BOOLEAN
) RETURNS TABLE(
    should_advance BOOLEAN,
    should_degrade BOOLEAN,
    current_level VARCHAR(20),
    new_level VARCHAR(20),
    consecutive_correct INTEGER,
    mistakes_in_recent INTEGER
) AS $$
DECLARE
    v_stats RECORD;
    v_current_level VARCHAR(20);
    v_should_advance BOOLEAN := FALSE;
    v_should_degrade BOOLEAN := FALSE;
    v_new_level VARCHAR(20);
BEGIN
    -- Get current level
    SELECT COALESCE(status, 'LEVEL_0') 
    INTO v_current_level
    FROM user_translation_progress 
    WHERE user_id = p_user_id AND word_pair_id = p_translation_id;
    
    -- Get statistics
    SELECT * INTO v_stats
    FROM get_word_statistics(p_session_id, p_translation_id, p_direction);
    
    -- Check advancement (3 consecutive correct)
    IF v_stats.consecutive_correct >= 3 THEN
        CASE v_current_level
            WHEN 'LEVEL_0' THEN v_new_level := 'LEVEL_1'; v_should_advance := TRUE;
            WHEN 'LEVEL_1' THEN v_new_level := 'LEVEL_2'; v_should_advance := TRUE;
            WHEN 'LEVEL_2' THEN v_new_level := 'LEVEL_3'; v_should_advance := TRUE;
        END CASE;
    END IF;
    
    -- Check degradation (3 mistakes in last 10 attempts)
    IF NOT v_should_advance AND v_stats.mistakes_in_recent >= 3 
       AND array_length(v_stats.recent_attempts, 1) >= 3 THEN
        CASE v_current_level
            WHEN 'LEVEL_3' THEN v_new_level := 'LEVEL_2'; v_should_degrade := TRUE;
            WHEN 'LEVEL_2' THEN v_new_level := 'LEVEL_1'; v_should_degrade := TRUE;
            WHEN 'LEVEL_1' THEN v_new_level := 'LEVEL_0'; v_should_degrade := TRUE;
        END CASE;
    END IF;
    
    RETURN QUERY
    SELECT 
        v_should_advance,
        v_should_degrade,
        v_current_level,
        COALESCE(v_new_level, v_current_level),
        v_stats.consecutive_correct,
        v_stats.mistakes_in_recent;
END;
$$ LANGUAGE plpgsql;
