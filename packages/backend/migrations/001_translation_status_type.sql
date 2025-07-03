-- Translation status enum type
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
        CREATE TYPE translation_status AS ENUM (
            'LEVEL_0',  -- New word
            'LEVEL_1',  -- Learning
            'LEVEL_2',  -- Translation mastered one way
            'LEVEL_3',  -- Translation mastered both ways
            'LEVEL_4',  -- Usage mastered one way
            'LEVEL_5'   -- Usage mastered both ways
        );
    END IF;
END $$;
