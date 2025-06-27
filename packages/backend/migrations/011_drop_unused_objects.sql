-- Migration: Drop unused SQL objects and clean up database
-- Date: 2025-01-23
-- Description: Remove unused SQL objects (functions, tables, sequences, indexes) that are no longer 
-- used after business logic was moved to frontend. This comprehensive cleanup transforms the database
-- from 50+ functions down to ~10 essential functions and removes all quiz session infrastructure.

-- Drop quiz orchestration functions (from 015_quiz_orchestration.sql)
DROP FUNCTION IF EXISTS get_next_quiz_question(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS process_quiz_answer(INTEGER, INTEGER, INTEGER, TEXT, TEXT);
DROP FUNCTION IF EXISTS check_level_progression(INTEGER, INTEGER, INTEGER, BOOLEAN);

-- Note: 014_cross_domain_functions.sql was cleaned to keep only essential functions:
-- - insert_word_pair_and_add_to_list (used in data migrations)
-- - remove_word_pair_and_list_entry (used in data migrations)  
-- - get_user_word_sets (used in API endpoints)

-- Drop session history functions (from 013_session_history.sql)
DROP FUNCTION IF EXISTS add_word_to_session_history(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_recently_asked_words(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS is_word_recently_asked(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS create_or_get_quiz_session(INTEGER, VARCHAR);

-- Drop quiz submission log functions (from 012_quiz_submission_log.sql) - ALL UNUSED
DROP FUNCTION IF EXISTS get_error_counts_for_words(INTEGER, INTEGER[]);
DROP FUNCTION IF EXISTS get_word_submission_stats(INTEGER, INTEGER, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS log_quiz_submission(INTEGER, INTEGER, INTEGER, BOOLEAN, TEXT, TEXT, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS util_remove_brackets(TEXT);
DROP FUNCTION IF EXISTS util_count_consecutive_correct(BOOLEAN[]);
DROP FUNCTION IF EXISTS util_count_mistakes_in_array(BOOLEAN[]);
DROP FUNCTION IF EXISTS util_check_answer_correctness(TEXT, TEXT);
DROP FUNCTION IF EXISTS util_create_bracket_alternatives(TEXT);
DROP FUNCTION IF EXISTS util_expand_parentheses_groups(TEXT);

-- Drop unused TTS function (from 011_tts.sql)
DROP FUNCTION IF EXISTS get_tts_cache_entry_validated_fixed(VARCHAR, TEXT);

-- Drop quiz session functions (from 009_quiz_session.sql)
DROP FUNCTION IF EXISTS validate_session_ownership(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS batch_promote_words_to_level1(INTEGER, INTEGER[]);
DROP FUNCTION IF EXISTS get_candidate_words(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS populate_focus_words(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS update_quiz_session_current_word(INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS check_and_switch_direction_if_l2_empty(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_quiz_completion_status(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS force_switch_to_normal_direction(INTEGER);
DROP FUNCTION IF EXISTS count_words_by_level(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_session_info(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS update_session_current_word(INTEGER, INTEGER);

-- Drop unused user translation progress function (from 007_user_translation_progress.sql)
DROP FUNCTION IF EXISTS update_user_word_level(INTEGER, INTEGER, VARCHAR);

-- Drop unused word utility functions (from 003_word.sql)
DROP FUNCTION IF EXISTS util_normalize_answer(TEXT);
DROP FUNCTION IF EXISTS util_clean_word_data(JSONB);

-- Drop additional functions that exist in staging/production but not in cleaned local migrations
DROP FUNCTION IF EXISTS get_quiz_completion_percentage(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS get_quiz_state(INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS get_words_by_level(INTEGER, INTEGER, VARCHAR);
DROP FUNCTION IF EXISTS is_quiz_complete(INTEGER, INTEGER);
DROP FUNCTION IF EXISTS util_remove_brackets(TEXT);

-- Drop production-specific migration utility functions (if they exist)
DROP FUNCTION IF EXISTS acquire_migration_lock();
DROP FUNCTION IF EXISTS release_migration_lock();

-- Drop quiz session tables and related infrastructure (completely unused)
-- Note: CASCADE will automatically drop related indexes, sequences, and constraints
DROP TABLE IF EXISTS session_word_history CASCADE;
DROP TABLE IF EXISTS quiz_session CASCADE;
DROP TABLE IF EXISTS quiz_submission_log CASCADE;

-- Drop orphaned sequences that may remain (if CASCADE didn't catch them)
DROP SEQUENCE IF EXISTS quiz_session_id_seq CASCADE;
DROP SEQUENCE IF EXISTS quiz_submission_log_id_seq CASCADE;
DROP SEQUENCE IF EXISTS session_word_history_id_seq CASCADE;

-- Drop old singular table indexes that were renamed to plural
-- These indexes were created in earlier migrations but need cleanup after table renames
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

-- VERIFICATION: After this migration, only these functions should remain:
-- Essential functions that are still in use:
-- 1. get_user_word_sets (API endpoint /api/word-sets/user)
-- 2. util_clean_pipe_alternatives (used by get_word_display_info in 014)
-- 3. get_word_lists (API endpoint /api/word-sets)
-- 4. update_user_word_set_status (API endpoint /api/word-sets/user POST)
-- 5. get_tts_cache_entry_validated (TTS service)
-- 6. save_tts_cache_entry_validated (TTS service)
-- 7. get_tts_cache_stats (TTS service)
-- 8. update_timestamp (trigger function)
-- 9. insert_word_pair_and_add_to_list (data migrations 901, 902)
-- 10. remove_word_pair_and_list_entry (data migrations 901, 902)
--
-- Expected result: ~10 functions remaining (down from 50+ in staging, 52+ in production)
--
-- OBJECTS THAT SHOULD REMAIN AFTER CLEANUP:
-- Tables: user, language, word, translation, word_list, word_list_entry, user_translation_progress, tts_cache, valid_tts_texts
-- Views: valid_tts_texts
-- Types: translation_status
-- Triggers: update_user_timestamp, update_word_list_timestamp
-- Sequences: language_id_seq, translation_id_seq, user_id_seq, word_id_seq, word_list_id_seq, word_list_entry_id_seq, user_translation_progress_id_seq, tts_cache_id_seq
-- Additional in production: schema_migrations table and schema_migrations_id_seq sequence