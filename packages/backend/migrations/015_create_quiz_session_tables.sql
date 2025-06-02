-- Create quiz session tables for managing quiz state in backend
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

CREATE TABLE IF NOT EXISTS quiz_session_stats (
    id SERIAL PRIMARY KEY,
    session_id INTEGER REFERENCES quiz_session(id) ON DELETE CASCADE,
    translation_id INTEGER REFERENCES translation(id),
    direction VARCHAR(10), -- 'normal' or 'reverse'
    attempts INTEGER DEFAULT 0,
    correct INTEGER DEFAULT 0,
    incorrect INTEGER DEFAULT 0,
    consecutive_mistakes INTEGER DEFAULT 0,
    last_answered_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(session_id, translation_id, direction)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_quiz_session_user_list ON quiz_session(user_id, word_list_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_stats_session ON quiz_session_stats(session_id);
CREATE INDEX IF NOT EXISTS idx_quiz_session_stats_translation ON quiz_session_stats(translation_id);

-- Critical composite index for quiz performance
CREATE INDEX IF NOT EXISTS idx_quiz_session_stats_session_translation_direction ON quiz_session_stats(session_id, translation_id, direction);