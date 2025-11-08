DROP FUNCTION IF EXISTS get_next_quiz_question(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS process_quiz_answer(
    INTEGER, INTEGER, INTEGER, TEXT, TEXT
);
DROP FUNCTION IF EXISTS check_level_progression(
    INTEGER, INTEGER, INTEGER, BOOLEAN
);

DROP FUNCTION IF EXISTS add_word_to_session_history(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_recently_asked_words(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS is_word_recently_asked(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS create_or_get_quiz_session(INTEGER, VARCHAR);

DROP FUNCTION IF EXISTS get_error_counts_for_words(INTEGER, INTEGER []);
DROP FUNCTION IF EXISTS get_word_submission_stats(
    INTEGER, INTEGER, BOOLEAN, INTEGER
);
DROP FUNCTION IF EXISTS log_quiz_submission(
    INTEGER, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, BOOLEAN, INTEGER
);
DROP FUNCTION IF EXISTS util_remove_brackets(TEXT);
DROP FUNCTION IF EXISTS util_count_consecutive_correct(BOOLEAN []);
DROP FUNCTION IF EXISTS util_count_mistakes_in_array(BOOLEAN []);
DROP FUNCTION IF EXISTS util_check_answer_correctness(TEXT, TEXT);
DROP FUNCTION IF EXISTS util_create_bracket_alternatives(TEXT);
DROP FUNCTION IF EXISTS util_expand_parentheses_groups(TEXT);

DROP FUNCTION IF EXISTS get_tts_cache_entry_validated_fixed(VARCHAR, TEXT);

DROP FUNCTION IF EXISTS validate_session_ownership(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS batch_promote_words_to_level1(INTEGER, INTEGER []);
DROP FUNCTION IF EXISTS get_candidate_words(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS populate_focus_words(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_quiz_session_current_word(
    INTEGER, INTEGER, INTEGER
);
DROP FUNCTION IF EXISTS check_and_switch_direction_if_l2_empty(
    INTEGER, INTEGER
);
DROP FUNCTION IF EXISTS get_quiz_completion_status(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS force_switch_to_normal_direction(INTEGER);
DROP FUNCTION IF EXISTS count_words_by_level(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_session_info(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS update_session_current_word(INTEGER, INTEGER);

DROP FUNCTION IF EXISTS update_user_word_level(INTEGER, INTEGER, VARCHAR);

DROP FUNCTION IF EXISTS util_normalize_answer(TEXT);
DROP FUNCTION IF EXISTS util_clean_word_data(JSONB);
DROP FUNCTION IF EXISTS util_clean_pipe_alternatives(TEXT);

DROP FUNCTION IF EXISTS get_quiz_completion_percentage(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_quiz_state(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_words_by_level(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS is_quiz_complete(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS util_remove_brackets(TEXT);

DROP FUNCTION IF EXISTS acquire_migration_lock();
DROP FUNCTION IF EXISTS release_migration_lock();

DROP FUNCTION IF EXISTS count_user_words_by_level(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_available_words(
    INTEGER, INTEGER, VARCHAR, INTEGER []
);
DROP FUNCTION IF EXISTS get_word_display_info(INTEGER);
DROP FUNCTION IF EXISTS get_word_statistics(INTEGER, INTEGER, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS get_words_by_level(INTEGER, INTEGER, VARCHAR, INTEGER);
DROP FUNCTION IF EXISTS log_quiz_submission(
    INTEGER,
    INTEGER,
    BOOLEAN,
    TEXT,
    TEXT,
    BOOLEAN,
    VARCHAR,
    TEXT,
    INTEGER,
    INTEGER,
    INTEGER,
    INTEGER
);
DROP FUNCTION IF EXISTS record_quiz_answer(
    INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, BOOLEAN, INTEGER
);

DROP FUNCTION IF EXISTS get_tts_cache_entry_validated_fixed(
    VARCHAR, TEXT
);

DROP TABLE IF EXISTS session_word_history CASCADE;
DROP TABLE IF EXISTS quiz_session CASCADE;
DROP TABLE IF EXISTS quiz_submission_log CASCADE;

DROP SEQUENCE IF EXISTS quiz_session_id_seq CASCADE;
DROP SEQUENCE IF EXISTS quiz_submission_log_id_seq CASCADE;
DROP SEQUENCE IF EXISTS session_word_history_id_seq CASCADE;

DROP INDEX IF EXISTS idx_user_username;
DROP INDEX IF EXISTS idx_language_name;
DROP INDEX IF EXISTS idx_word_language;
DROP INDEX IF EXISTS idx_word_text;
DROP INDEX IF EXISTS idx_word_language_text;
DROP INDEX IF EXISTS idx_word_unique_per_language;
DROP INDEX IF EXISTS idx_translation_source;
DROP INDEX IF EXISTS idx_translation_target;
DROP INDEX IF EXISTS idx_word_list_name;
DROP INDEX IF EXISTS idx_word_list_entry_translation;
DROP INDEX IF EXISTS idx_word_list_entry_list;
DROP INDEX IF EXISTS idx_word_list_entry_list_translation;
DROP INDEX IF EXISTS idx_user_translation_progress_user;
DROP INDEX IF EXISTS idx_user_translation_progress_word_pair;
DROP INDEX IF EXISTS idx_user_translation_progress_user_status;
DROP INDEX IF EXISTS idx_user_translation_progress_word_pair_status;
DROP INDEX IF EXISTS idx_user_translation_progress_user_updated;
DROP INDEX IF EXISTS idx_tts_cache_key;
DROP INDEX IF EXISTS idx_tts_cache_created_at;
DROP INDEX IF EXISTS idx_tts_cache_last_accessed;

DROP INDEX IF EXISTS idx_user_translation_progresses_user;
DROP INDEX IF EXISTS idx_user_translation_progresses_word_pair;
DROP INDEX IF EXISTS idx_user_translation_progresses_user_status;
DROP INDEX IF EXISTS idx_user_translation_progresses_word_pair_status;

DROP INDEX IF EXISTS idx_user_translation_progress_batch_update;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_translation_progresses_pkey') THEN
        ALTER TABLE user_translation_progress DROP CONSTRAINT user_translation_progresses_pkey;
    END IF;
END $$;

DROP TRIGGER IF EXISTS update_user_timestamp ON users;
