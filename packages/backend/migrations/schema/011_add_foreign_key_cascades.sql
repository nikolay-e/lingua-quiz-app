ALTER TABLE translations DROP CONSTRAINT IF EXISTS translations_source_word_id_fkey;
ALTER TABLE translations DROP CONSTRAINT IF EXISTS translations_target_word_id_fkey;

ALTER TABLE translations
ADD CONSTRAINT translations_source_word_id_fkey
FOREIGN KEY (source_word_id) REFERENCES words (id) ON DELETE CASCADE;

ALTER TABLE translations
ADD CONSTRAINT translations_target_word_id_fkey
FOREIGN KEY (target_word_id) REFERENCES words (id) ON DELETE CASCADE;
