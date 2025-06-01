-- Create quiz functions for managing quiz state
CREATE OR REPLACE FUNCTION get_quiz_state(p_user_id INTEGER, p_word_list_name VARCHAR)
RETURNS TABLE (
    session_id INTEGER,
    direction BOOLEAN,
    current_translation_id INTEGER,
    source_language TEXT,
    target_language TEXT,
    level_0_words JSONB,
    level_1_words JSONB,
    level_2_words JSONB,
    level_3_words JSONB
) AS $$
DECLARE
    v_word_list_id INTEGER;
    v_session_id INTEGER;
BEGIN
    -- Get word list ID
    SELECT id INTO v_word_list_id FROM word_list WHERE name = p_word_list_name;
    
    -- Get or create session
    INSERT INTO quiz_session (user_id, word_list_id)
    VALUES (p_user_id, v_word_list_id)
    ON CONFLICT (user_id, word_list_id) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING id INTO v_session_id;
    
    -- Return complete state
    RETURN QUERY
    WITH word_data AS (
        SELECT 
            t.id as translation_id,
            COALESCE(utp.status, 'LEVEL_0') as status,
            sw.text as source_word,
            tw.text as target_word,
            sl.name as source_language,
            tl.name as target_language,
            sw.usage_example as source_example,
            tw.usage_example as target_example
        FROM word_list_entry wle
        JOIN translation t ON wle.translation_id = t.id
        JOIN word sw ON t.source_word_id = sw.id
        JOIN word tw ON t.target_word_id = tw.id
        JOIN language sl ON sw.language_id = sl.id
        JOIN language tl ON tw.language_id = tl.id
        LEFT JOIN user_translation_progress utp ON utp.word_pair_id = t.id AND utp.user_id = p_user_id
        WHERE wle.word_list_id = v_word_list_id
    )
    SELECT 
        v_session_id as session_id,
        qs.direction,
        qs.current_translation_id,
        MIN(wd.source_language) as source_language,
        MIN(wd.target_language) as target_language,
        COALESCE(jsonb_agg(jsonb_build_object('id', wd.translation_id, 'source', wd.source_word, 'target', wd.target_word, 'sourceExample', wd.source_example, 'targetExample', wd.target_example)) FILTER (WHERE wd.status = 'LEVEL_0'), '[]'::jsonb) as level_0_words,
        COALESCE(jsonb_agg(jsonb_build_object('id', wd.translation_id, 'source', wd.source_word, 'target', wd.target_word, 'sourceExample', wd.source_example, 'targetExample', wd.target_example)) FILTER (WHERE wd.status = 'LEVEL_1'), '[]'::jsonb) as level_1_words,
        COALESCE(jsonb_agg(jsonb_build_object('id', wd.translation_id, 'source', wd.source_word, 'target', wd.target_word, 'sourceExample', wd.source_example, 'targetExample', wd.target_example)) FILTER (WHERE wd.status = 'LEVEL_2'), '[]'::jsonb) as level_2_words,
        COALESCE(jsonb_agg(jsonb_build_object('id', wd.translation_id, 'source', wd.source_word, 'target', wd.target_word, 'sourceExample', wd.source_example, 'targetExample', wd.target_example)) FILTER (WHERE wd.status = 'LEVEL_3'), '[]'::jsonb) as level_3_words
    FROM quiz_session qs, word_data wd
    WHERE qs.id = v_session_id
    GROUP BY qs.direction, qs.current_translation_id;
END;
$$ LANGUAGE plpgsql;