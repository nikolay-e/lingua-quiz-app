CREATE
OR REPLACE FUNCTION update_timestamp () RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = CURRENT_TIMESTAMP;
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_timestamp') THEN
    CREATE TRIGGER update_user_timestamp
    BEFORE UPDATE ON "user"
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_word_list_timestamp') THEN
    CREATE TRIGGER update_word_list_timestamp
    BEFORE UPDATE ON word_list
    FOR EACH ROW
    EXECUTE FUNCTION update_timestamp();
  END IF;
END $$;
