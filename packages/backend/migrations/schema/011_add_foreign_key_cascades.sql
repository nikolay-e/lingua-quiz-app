-- Add ON DELETE CASCADE to foreign key constraints in translations table
-- This ensures consistent behavior with word_list_entries table

-- Drop existing foreign key constraints
ALTER TABLE translations DROP CONSTRAINT IF EXISTS translations_source_word_id_fkey;
ALTER TABLE translations DROP CONSTRAINT IF EXISTS translations_target_word_id_fkey;

-- Recreate with CASCADE
ALTER TABLE translations
ADD CONSTRAINT translations_source_word_id_fkey
FOREIGN KEY (source_word_id) REFERENCES words (id) ON DELETE CASCADE;

ALTER TABLE translations
ADD CONSTRAINT translations_target_word_id_fkey
FOREIGN KEY (target_word_id) REFERENCES words (id) ON DELETE CASCADE;
