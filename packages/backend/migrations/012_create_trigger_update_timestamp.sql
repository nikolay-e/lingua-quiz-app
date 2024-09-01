CREATE
OR REPLACE FUNCTION update_timestamp () RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ language 'plpgsql';

DO $$
BEGIN
    -- Check if 'update_user_timestamp' trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_user_timestamp' 
        AND tgrelid = 'user'::regclass
    ) THEN
        CREATE TRIGGER update_user_timestamp
        BEFORE UPDATE ON "user"
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();
    END IF;

    -- Check if 'update_word_list_timestamp' trigger exists
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_word_list_timestamp' 
        AND tgrelid = 'word_list'::regclass
    ) THEN
        CREATE TRIGGER update_word_list_timestamp
        BEFORE UPDATE ON word_list
        FOR EACH ROW
        EXECUTE FUNCTION update_timestamp();
    END IF;
END $$;
