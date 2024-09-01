DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
        CREATE TYPE translation_status AS ENUM (
            'Focus Words',
            'Mastered One Direction',
            'Mastered Vocabulary'
        );
    END IF;
END $$;
