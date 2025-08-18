-- Alter existing users table if it exists
DO $$
BEGIN
    -- Only modify existing table if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        -- Drop updated_at column if it exists
        IF EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'users' AND column_name = 'updated_at') THEN
            ALTER TABLE users DROP COLUMN updated_at;
        END IF;

        -- Add current_level column if it doesn't exist and translation_status type exists
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                       WHERE table_name = 'users' AND column_name = 'current_level')
           AND EXISTS (SELECT 1 FROM pg_type WHERE typname = 'translation_status') THEN
            ALTER TABLE users ADD COLUMN current_level translation_status DEFAULT 'LEVEL_1';
        END IF;
    END IF;
END $$;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    current_level TRANSLATION_STATUS DEFAULT 'LEVEL_1'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);
