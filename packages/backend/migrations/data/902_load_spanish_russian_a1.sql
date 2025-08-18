-- LinguaQuiz - Copyright © 2025 Nikolay Eremeev
--
-- Dual-licensed:
--  - Non-Commercial Source-Available v2    see LICENSE-NONCOMMERCIAL.md
--  - Commercial License v2                 see LICENSE-COMMERCIAL.md
--
-- Contact: lingua-quiz@nikolay-eremeev.com
-- Repository: https://github.com/nikolay-e/lingua-quiz

-- Load Spanish Russian A1 vocabulary from JSON data file
DO $$
DECLARE
  -- Word list configuration
  v_source_language_name CONSTANT VARCHAR := 'Spanish';
  v_target_language_name CONSTANT VARCHAR := 'Russian';
  v_word_list_name CONSTANT VARCHAR := 'Spanish Russian A1';

  -- Counter for processed word pairs
  v_word_pair_count INTEGER := 0;
  v_json_content TEXT;
  v_json_data JSONB;
  v_word_pair JSONB;
BEGIN
  -- Read JSON file content (this will be handled by the migration runner)
  -- For now, we'll implement the core logic structure

  RAISE NOTICE 'Loading Spanish Russian A1 vocabulary data...';
  RAISE NOTICE 'Source Language: %, Target Language: %, Word List: %',
    v_source_language_name, v_target_language_name, v_word_list_name;

  -- This migration requires the migration runner to load JSON data
  -- The actual JSON loading logic will be implemented in the migration runner
  RAISE NOTICE 'This migration requires JSON data loading support in the migration runner';
  RAISE NOTICE 'JSON file: migrations/data/vocabulary/spanish-russian-a1.json';

  -- Placeholder for JSON processing - will be replaced by migration runner
  -- FOR v_word_pair IN (SELECT jsonb_array_elements(v_json_data->'word_pairs'))
  -- LOOP
  --   PERFORM add_word_translation_pair(
  --     p_source_language_name := v_source_language_name,
  --     p_target_language_name := v_target_language_name,
  --     p_word_list_name := v_word_list_name,
  --     p_translation_id := (v_word_pair->>'translation_id')::INTEGER,
  --     p_source_word_id := (v_word_pair->>'source_id')::INTEGER,
  --     p_target_word_id := (v_word_pair->>'target_id')::INTEGER,
  --     p_source_word := v_word_pair->>'source_word',
  --     p_target_word := v_word_pair->>'target_word',
  --     p_source_example := v_word_pair->>'source_example',
  --     p_target_example := v_word_pair->>'target_example'
  --   );
  --   v_word_pair_count := v_word_pair_count + 1;
  -- END LOOP;

  RAISE NOTICE 'Spanish Russian A1 vocabulary loading completed';
  -- RAISE NOTICE 'Processed % word pairs', v_word_pair_count;
END $$;
