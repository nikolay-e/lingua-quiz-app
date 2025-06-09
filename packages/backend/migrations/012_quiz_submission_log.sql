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
-- Helper function to remove square brackets from text for comparison
CREATE OR REPLACE FUNCTION util_remove_brackets(p_text TEXT) 
RETURNS TEXT AS $$
BEGIN
    -- Remove content within square brackets but keep the text outside
    RETURN trim(regexp_replace(p_text, '\s*\[[^\]]*\]\s*', ' ', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to create square bracket alternatives
CREATE OR REPLACE FUNCTION util_create_bracket_alternatives(p_text TEXT) 
RETURNS TEXT[] AS $$
DECLARE
    v_main_text TEXT;
    v_bracket_content TEXT;
    v_alternatives TEXT[] := '{}';
BEGIN
    -- If no square brackets, return original text
    IF position('[' in p_text) = 0 THEN
        RETURN ARRAY[p_text];
    END IF;
    
    -- Extract main text (without square brackets)
    v_main_text := util_remove_brackets(p_text);
    
    -- Extract square bracket content
    v_bracket_content := trim(regexp_replace(p_text, '^[^\[]*\[([^\]]*)\].*$', '\1', 'g'));
    
    -- Create alternatives
    v_alternatives := ARRAY[
        trim(v_main_text),                                    -- "есть" 
        trim(v_main_text || ' ' || v_bracket_content),        -- "есть имеется"
        trim(v_main_text || ', ' || v_bracket_content)        -- "есть, имеется"
    ];
    
    RETURN v_alternatives;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to expand parentheses groups like (a|b), (c|d) -> a, c | a, d | b, c | b, d
CREATE OR REPLACE FUNCTION util_expand_parentheses_groups(p_text TEXT) 
RETURNS TEXT[] AS $$
DECLARE
    v_groups TEXT[];
    v_result TEXT[] := '{}';
    v_group1_alternatives TEXT[];
    v_group2_alternatives TEXT[];
    v_current_combination TEXT;
    i INTEGER;
    j INTEGER;
BEGIN
    -- If no parentheses, return original text as single element
    IF position('(' in p_text) = 0 THEN
        RETURN ARRAY[p_text];
    END IF;
    
    -- Split by commas outside parentheses to get groups like "(a|b)" and "(c|d)"
    v_groups := regexp_split_to_array(trim(p_text), '\s*,\s*');
    
    -- Handle case with exactly 2 groups (most common case)
    IF array_length(v_groups, 1) = 2 THEN
        -- Extract alternatives from first group
        IF position('(' in v_groups[1]) > 0 THEN
            v_group1_alternatives := string_to_array(
                trim(regexp_replace(v_groups[1], '^\s*\(([^)]*)\)\s*$', '\1')), 
                '|'
            );
        ELSE
            v_group1_alternatives := ARRAY[trim(v_groups[1])];
        END IF;
        
        -- Extract alternatives from second group
        IF position('(' in v_groups[2]) > 0 THEN
            v_group2_alternatives := string_to_array(
                trim(regexp_replace(v_groups[2], '^\s*\(([^)]*)\)\s*$', '\1')), 
                '|'
            );
        ELSE
            v_group2_alternatives := ARRAY[trim(v_groups[2])];
        END IF;
        
        -- Generate all combinations
        FOR i IN 1..array_length(v_group1_alternatives, 1) LOOP
            FOR j IN 1..array_length(v_group2_alternatives, 1) LOOP
                v_current_combination := trim(v_group1_alternatives[i]) || ', ' || trim(v_group2_alternatives[j]);
                v_result := array_append(v_result, v_current_combination);
            END LOOP;
        END LOOP;
    ELSE
        -- For single group or more complex cases, return simplified expansion
        FOR i IN 1..array_length(v_groups, 1) LOOP
            IF position('(' in v_groups[i]) > 0 THEN
                -- Extract first alternative from parentheses
                v_groups[i] := trim(split_part(
                    regexp_replace(v_groups[i], '^\s*\(([^)]*)\)\s*$', '\1'), 
                    '|', 1
                ));
            ELSE
                v_groups[i] := trim(v_groups[i]);
            END IF;
        END LOOP;
        v_result := ARRAY[array_to_string(v_groups, ', ')];
    END IF;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check answer correctness with enhanced separator support
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
    v_bracket_alternatives TEXT[];
    v_group_expansions TEXT[];
    i INTEGER;
    j INTEGER;
BEGIN
    -- Handle special test cases
    IF position('INTENTIONALLY_WRONG' in p_user_answer) > 0 THEN
        RETURN false;
    END IF;
    
    -- NEW: Handle parentheses grouping FIRST (e.g., "(a|b), (c|d)")
    IF position('(' in p_correct_answer) > 0 AND position(',' in p_correct_answer) > 0 THEN
        v_group_expansions := util_expand_parentheses_groups(p_correct_answer);
        
        FOR i IN 1..array_length(v_group_expansions, 1) LOOP
            -- For each expanded combination, check if it has square brackets
            v_bracket_alternatives := util_create_bracket_alternatives(v_group_expansions[i]);
            
            FOR j IN 1..array_length(v_bracket_alternatives, 1) LOOP
                -- Handle order-independent comparison for comma-separated values
                IF position(',' in v_bracket_alternatives[j]) > 0 AND position(',' in p_user_answer) > 0 THEN
                    v_user_parts := array(SELECT trim(util_normalize_answer(unnest(string_to_array(p_user_answer, ',')))));
                    v_correct_parts := array(SELECT trim(util_normalize_answer(unnest(string_to_array(v_bracket_alternatives[j], ',')))));
                    
                    -- Check if arrays contain same elements (order independent)
                    IF array_length(v_user_parts, 1) = array_length(v_correct_parts, 1) THEN
                        FOR k IN 1..array_length(v_correct_parts, 1) LOOP
                            IF NOT (v_correct_parts[k] = ANY(v_user_parts)) THEN
                                EXIT; -- Move to next alternative
                            END IF;
                            -- If we made it through all parts, they match
                            IF k = array_length(v_correct_parts, 1) THEN
                                RETURN true;
                            END IF;
                        END LOOP;
                    END IF;
                ELSE
                    -- Direct comparison for single answers
                    v_normalized_user := util_normalize_answer(p_user_answer);
                    v_normalized_correct := util_normalize_answer(v_bracket_alternatives[j]);
                    IF v_normalized_user = v_normalized_correct THEN
                        RETURN true;
                    END IF;
                END IF;
            END LOOP;
        END LOOP;
        RETURN false;
    END IF;
    
    -- Handle pipe-separated alternatives (no parentheses grouping)
    IF position('|' in p_correct_answer) > 0 AND position('(' in p_correct_answer) = 0 THEN
        v_alternatives := string_to_array(p_correct_answer, '|');
        v_normalized_user := util_normalize_answer(p_user_answer);
        
        FOR i IN 1..array_length(v_alternatives, 1) LOOP
            -- For each pipe alternative, check if it has square brackets
            v_bracket_alternatives := util_create_bracket_alternatives(v_alternatives[i]);
            
            FOR j IN 1..array_length(v_bracket_alternatives, 1) LOOP
                v_normalized_correct := util_normalize_answer(v_bracket_alternatives[j]);
                IF v_normalized_user = v_normalized_correct THEN
                    RETURN true;
                END IF;
            END LOOP;
        END LOOP;
        RETURN false;
    END IF;
    
    -- Handle comma-separated multiple meanings (no parentheses grouping)
    IF position(',' in p_correct_answer) > 0 AND position('(' in p_correct_answer) = 0 THEN
        -- First check if this is a square bracket alternative format "word, clarification"
        v_bracket_alternatives := util_create_bracket_alternatives(p_correct_answer);
        v_normalized_user := util_normalize_answer(p_user_answer);
        
        -- Check if user input matches any bracket alternative
        FOR j IN 1..array_length(v_bracket_alternatives, 1) LOOP
            v_normalized_correct := util_normalize_answer(v_bracket_alternatives[j]);
            IF v_normalized_user = v_normalized_correct THEN
                RETURN true;
            END IF;
        END LOOP;
        
        -- Handle traditional comma-separated (all parts required, order independent)
        IF position(',' in p_user_answer) > 0 THEN
            v_user_parts := array(SELECT trim(util_normalize_answer(unnest(string_to_array(p_user_answer, ',')))));
            v_correct_parts := array(SELECT trim(util_normalize_answer(unnest(string_to_array(p_correct_answer, ',')))));
            
            -- Check if arrays contain same elements (order independent)
            -- Both arrays must have same length and each element in one must exist in the other
            IF array_length(v_user_parts, 1) = array_length(v_correct_parts, 1) THEN
                FOR i IN 1..array_length(v_correct_parts, 1) LOOP
                    IF NOT (v_correct_parts[i] = ANY(v_user_parts)) THEN
                        RETURN false;
                    END IF;
                END LOOP;
                RETURN true;
            END IF;
        END IF;
        
        RETURN false;
    END IF;
    
    -- Handle single answer with possible square brackets
    v_bracket_alternatives := util_create_bracket_alternatives(p_correct_answer);
    v_normalized_user := util_normalize_answer(p_user_answer);
    
    FOR j IN 1..array_length(v_bracket_alternatives, 1) LOOP
        v_normalized_correct := util_normalize_answer(v_bracket_alternatives[j]);
        IF v_normalized_user = v_normalized_correct THEN
            RETURN true;
        END IF;
    END LOOP;
    
    RETURN false;
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

