-- Modern quiz functions - focused and clean
-- Replaces the old complex get_quiz_state function

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS get_quiz_state(INTEGER, VARCHAR(255)) CASCADE;

-- Replacement for the complex get_quiz_state function (now lightweight)
CREATE OR REPLACE FUNCTION get_quiz_state(
    p_user_id INTEGER, 
    p_word_list_name VARCHAR(255)
) RETURNS TABLE (
    session_id INTEGER,
    word_list_id INTEGER,
    direction BOOLEAN,
    current_translation_id INTEGER,
    level_0_count BIGINT,
    level_1_count BIGINT,
    level_2_count BIGINT,
    level_3_count BIGINT,
    total_words BIGINT
) AS $$
DECLARE
    v_word_list_id INTEGER;
    v_session_id INTEGER;
BEGIN
    -- Get word list ID
    SELECT id INTO v_word_list_id 
    FROM word_list 
    WHERE name = p_word_list_name;
    
    IF v_word_list_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Get or create session
    INSERT INTO quiz_session (user_id, word_list_id, direction)
    VALUES (p_user_id, v_word_list_id, true)
    ON CONFLICT (user_id, word_list_id) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_session_id;
    
    -- Return basic state with counts
    RETURN QUERY
    SELECT 
        v_session_id,
        v_word_list_id,
        qs.direction,
        qs.current_translation_id,
        counts.level_0_count,
        counts.level_1_count,
        counts.level_2_count,
        counts.level_3_count,
        counts.total_words
    FROM quiz_session qs
    CROSS JOIN count_user_words_by_level(p_user_id, v_word_list_id) counts
    WHERE qs.id = v_session_id;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS is_quiz_complete(INTEGER, INTEGER) CASCADE;

-- Function to check if quiz is complete
CREATE OR REPLACE FUNCTION is_quiz_complete(
    p_user_id INTEGER,
    p_word_list_id INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    v_counts RECORD;
BEGIN
    SELECT * INTO v_counts
    FROM count_user_words_by_level(p_user_id, p_word_list_id);
    
    RETURN v_counts.level_3_count = v_counts.total_words AND v_counts.total_words > 0;
END;
$$ LANGUAGE plpgsql;

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS get_quiz_completion_percentage(INTEGER, INTEGER) CASCADE;

-- Function to get quiz completion percentage
CREATE OR REPLACE FUNCTION get_quiz_completion_percentage(
    p_user_id INTEGER,
    p_word_list_id INTEGER
) RETURNS NUMERIC AS $$
DECLARE
    v_counts RECORD;
BEGIN
    SELECT * INTO v_counts
    FROM count_user_words_by_level(p_user_id, p_word_list_id);
    
    IF v_counts.total_words = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ROUND((v_counts.level_3_count::NUMERIC / v_counts.total_words) * 100, 1);
END;
$$ LANGUAGE plpgsql;

-- Drop existing function if it exists (handles signature changes)
DROP FUNCTION IF EXISTS get_words_by_level(INTEGER, INTEGER, VARCHAR, INTEGER) CASCADE;

-- Function to get words by level (simple list, not complex JSONB)
CREATE OR REPLACE FUNCTION get_words_by_level(
    p_user_id INTEGER,
    p_word_list_id INTEGER,
    p_level VARCHAR(20),
    p_limit INTEGER DEFAULT NULL
) RETURNS TABLE(
    translation_id INTEGER,
    source_word TEXT,
    target_word TEXT,
    source_language TEXT,
    target_language TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        util_clean_pipe_alternatives(sw.text),
        util_clean_pipe_alternatives(tw.text),
        sl.name,
        tl.name
    FROM word_list_entry wle
    JOIN translation t ON t.id = wle.translation_id
    JOIN word sw ON t.source_word_id = sw.id
    JOIN word tw ON t.target_word_id = tw.id
    JOIN language sl ON sw.language_id = sl.id
    JOIN language tl ON tw.language_id = tl.id
    LEFT JOIN user_translation_progress utp 
        ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
    WHERE wle.word_list_id = p_word_list_id 
    AND (
        (p_level = 'LEVEL_0' AND (utp.status = 'LEVEL_0' OR utp.status IS NULL)) OR
        (utp.status = p_level)
    )
    ORDER BY t.id
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;
