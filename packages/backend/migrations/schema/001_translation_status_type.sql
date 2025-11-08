DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
        CREATE TYPE translation_status AS ENUM (
            'LEVEL_0',
            'LEVEL_1',
            'LEVEL_2',
            'LEVEL_3',
            'LEVEL_4',
            'LEVEL_5'
        );
    END IF;
END $$;
