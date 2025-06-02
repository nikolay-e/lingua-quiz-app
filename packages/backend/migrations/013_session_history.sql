-- Session history table (replaces last_asked_words array for better performance)
CREATE TABLE IF NOT EXISTS session_word_history (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES quiz_session(id) ON DELETE CASCADE,
    word_id INTEGER REFERENCES translation(id),
    asked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    sequence_number INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_session_history_session_seq ON session_word_history(session_id, sequence_number DESC);
CREATE INDEX IF NOT EXISTS idx_session_history_word_recent ON session_word_history(word_id, asked_at DESC);

-- Functions
CREATE OR REPLACE FUNCTION add_word_to_session_history(
    p_session_id INTEGER,
    p_word_id INTEGER,
    p_max_history INTEGER DEFAULT 7
) RETURNS VOID AS $$
DECLARE
    v_next_seq INTEGER;
BEGIN
    -- Get next sequence number
    SELECT COALESCE(MAX(sequence_number), 0) + 1 
    INTO v_next_seq
    FROM session_word_history 
    WHERE session_id = p_session_id;
    
    -- Insert new history entry
    INSERT INTO session_word_history (session_id, word_id, sequence_number)
    VALUES (p_session_id, p_word_id, v_next_seq);
    
    -- Clean old history (keep only last N entries)
    DELETE FROM session_word_history 
    WHERE session_id = p_session_id 
    AND sequence_number <= v_next_seq - p_max_history;
END;
$$ LANGUAGE plpgsql;

-- Function to get recently asked words (replaces array operations)
CREATE OR REPLACE FUNCTION get_recently_asked_words(
    p_session_id INTEGER,
    p_limit INTEGER DEFAULT 7
) RETURNS INTEGER[] AS $$
BEGIN
    RETURN COALESCE(ARRAY(
        SELECT word_id 
        FROM session_word_history 
        WHERE session_id = p_session_id 
        ORDER BY sequence_number DESC 
        LIMIT p_limit
    ), ARRAY[]::INTEGER[]);
END;
$$ LANGUAGE plpgsql;

-- Function to check if word was recently asked
CREATE OR REPLACE FUNCTION is_word_recently_asked(
    p_session_id INTEGER,
    p_word_id INTEGER,
    p_within_last INTEGER DEFAULT 7
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM session_word_history 
        WHERE session_id = p_session_id 
        AND word_id = p_word_id
        AND sequence_number > (
            SELECT COALESCE(MAX(sequence_number), 0) - p_within_last
            FROM session_word_history 
            WHERE session_id = p_session_id
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Data migration and cleanup
DO $$
DECLARE
    rec RECORD;
    word_id INTEGER;
    seq_num INTEGER;
    column_exists BOOLEAN := FALSE;
BEGIN
    -- Check if last_asked_words column exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_session' 
        AND column_name = 'last_asked_words'
    ) INTO column_exists;
    
    -- Only run migration if column exists
    IF column_exists THEN
        FOR rec IN SELECT id, last_asked_words FROM quiz_session WHERE last_asked_words IS NOT NULL
        LOOP
            seq_num := 1;
            FOREACH word_id IN ARRAY rec.last_asked_words
            LOOP
                INSERT INTO session_word_history (session_id, word_id, sequence_number)
                VALUES (rec.id, word_id, seq_num);
                seq_num := seq_num + 1;
            END LOOP;
        END LOOP;
    END IF;
END;
$$;

ALTER TABLE quiz_session DROP COLUMN IF EXISTS last_asked_words;
CREATE OR REPLACE FUNCTION create_or_get_quiz_session(
    p_user_id INTEGER,
    p_word_list_name VARCHAR(255)
) RETURNS INTEGER AS $$
DECLARE
    v_session_id INTEGER;
    v_word_list_id INTEGER;
BEGIN
    -- Get word list ID
    SELECT id INTO v_word_list_id 
    FROM word_list 
    WHERE name = p_word_list_name;
    
    IF v_word_list_id IS NULL THEN
        RETURN NULL; -- Word list not found
    END IF;
    
    -- Get or create session
    SELECT id INTO v_session_id
    FROM quiz_session 
    WHERE user_id = p_user_id AND word_list_id = v_word_list_id;
    
    IF v_session_id IS NULL THEN
        INSERT INTO quiz_session (user_id, word_list_id, direction)
        VALUES (p_user_id, v_word_list_id, true)
        RETURNING id INTO v_session_id;
    END IF;
    
    RETURN v_session_id;
END;
$$ LANGUAGE plpgsql;

