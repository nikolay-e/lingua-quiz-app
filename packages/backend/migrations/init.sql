-- Enable PostgreSQL extensions for full-text search
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- CONTENT VERSIONING
-- ============================================

CREATE TABLE content_versions (
    id SERIAL PRIMARY KEY,
    version_name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,

    -- Ensure only one active version at a time
    CONSTRAINT only_one_active EXCLUDE USING gist (
        is_active WITH =
    ) WHERE (is_active)
);

CREATE INDEX idx_content_versions_active ON content_versions (is_active) WHERE is_active;

-- ============================================
-- USERS (with admin support)
-- ============================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL CHECK (LENGTH(username) BETWEEN 3 AND 50),
    password TEXT NOT NULL,
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- REFRESH TOKENS (JWT refresh token storage)
-- ============================================

CREATE TABLE refresh_tokens (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    device_info TEXT
);

CREATE INDEX idx_refresh_tokens_user ON refresh_tokens (user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens (token_hash);
CREATE INDEX idx_refresh_tokens_expires ON refresh_tokens (expires_at);

-- ============================================
-- VOCABULARY ITEMS (UUID-based, mutable content)
-- ============================================

CREATE TABLE vocabulary_items (
    id UUID PRIMARY KEY DEFAULT UUID_GENERATE_V4(),
    version_id INTEGER NOT NULL REFERENCES content_versions (id) ON DELETE CASCADE,

    -- Core content (MUTABLE - can be edited without breaking references)
    source_language VARCHAR(10) NOT NULL,
    target_language VARCHAR(10) NOT NULL,
    source_text TEXT NOT NULL,
    target_text TEXT NOT NULL,

    -- Learning context
    list_name TEXT NOT NULL,
    difficulty_level VARCHAR(5),  -- A0, A1, A2, B1, B2, C1, C2

    -- Optional enrichment
    source_usage_example TEXT,
    target_usage_example TEXT,

    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Prevent duplicates per version
    CONSTRAINT unique_translation_per_version
    UNIQUE (version_id, source_text, source_language, target_language)
);

-- Performance indexes
CREATE INDEX idx_vocab_list ON vocabulary_items (list_name, version_id) WHERE is_active;
CREATE INDEX idx_vocab_languages ON vocabulary_items (source_language, target_language, version_id) WHERE is_active;
CREATE INDEX idx_vocab_active ON vocabulary_items (is_active);
CREATE INDEX idx_vocab_version ON vocabulary_items (version_id);
CREATE INDEX idx_vocab_version_fk ON vocabulary_items (version_id);

-- Full-text search (PostgreSQL native)
CREATE INDEX idx_vocab_fts_source ON vocabulary_items
USING gin (TO_TSVECTOR('simple', source_text));
CREATE INDEX idx_vocab_fts_target ON vocabulary_items
USING gin (TO_TSVECTOR('simple', target_text));

-- Trigram index for fuzzy matching
CREATE INDEX idx_vocab_trigram_source ON vocabulary_items
USING gin (source_text gin_trgm_ops);
CREATE INDEX idx_vocab_trigram_target ON vocabulary_items
USING gin (target_text gin_trgm_ops);

-- ============================================
-- USER PROGRESS (Stable references via UUID)
-- ============================================

CREATE TABLE user_progress (
    user_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    vocabulary_item_id UUID NOT NULL REFERENCES vocabulary_items (id) ON DELETE CASCADE,

    -- Spaced repetition state
    level SMALLINT NOT NULL CHECK (level BETWEEN 0 AND 5),
    queue_position INTEGER NOT NULL CHECK (queue_position >= 0),
    consecutive_correct SMALLINT NOT NULL DEFAULT 0,

    -- Statistics
    correct_count INTEGER NOT NULL DEFAULT 0 CHECK (correct_count >= 0),
    incorrect_count INTEGER NOT NULL DEFAULT 0 CHECK (incorrect_count >= 0),
    recent_history BOOLEAN [] DEFAULT '{}',  -- Last 10 attempts

    -- Temporal tracking
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_practiced_at TIMESTAMPTZ,

    PRIMARY KEY (user_id, vocabulary_item_id)
);

CREATE INDEX idx_progress_user_level ON user_progress (user_id, level);
CREATE INDEX idx_progress_user_queue ON user_progress (user_id, queue_position);
CREATE INDEX idx_progress_last_practiced ON user_progress (user_id, last_practiced_at);

-- ============================================
-- CONTENT CHANGELOG (Audit trail)
-- ============================================

CREATE TABLE content_changelog (
    id BIGSERIAL PRIMARY KEY,
    version_id INTEGER REFERENCES content_versions (id),
    change_type TEXT NOT NULL CHECK (change_type IN ('ADD', 'UPDATE', 'DELETE')),
    vocabulary_item_id UUID REFERENCES vocabulary_items (id),
    old_values JSONB,
    new_values JSONB,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    changed_by TEXT
);

CREATE INDEX idx_changelog_version ON content_changelog (version_id);
CREATE INDEX idx_changelog_item ON content_changelog (vocabulary_item_id);
CREATE INDEX idx_changelog_timestamp ON content_changelog (changed_at DESC);

-- ============================================
-- TTS CACHE (Unchanged, but optimized)
-- ============================================

CREATE TABLE tts_cache (
    cache_key TEXT PRIMARY KEY,  -- hash(text + language + voice_params)
    audio_data BYTEA NOT NULL,
    text TEXT NOT NULL,
    language VARCHAR(10) NOT NULL,
    voice_config JSONB,  -- {"voice": "en-US-Neural2-A", "speed": 1.0}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tts_access ON tts_cache (last_accessed_at);
CREATE INDEX idx_tts_created ON tts_cache (created_at);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION UPDATE_UPDATED_AT_COLUMN()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to vocabulary_items
CREATE TRIGGER update_vocabulary_items_updated_at
BEFORE UPDATE ON vocabulary_items
FOR EACH ROW
EXECUTE FUNCTION UPDATE_UPDATED_AT_COLUMN();

-- Function to get active vocabulary version
CREATE OR REPLACE FUNCTION GET_ACTIVE_VERSION_ID()
RETURNS INTEGER AS $$
BEGIN
    RETURN (SELECT id FROM content_versions WHERE is_active = TRUE LIMIT 1);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- INITIAL DATA
-- ============================================

-- Create initial content version
INSERT INTO content_versions (version_name, description, is_active)
VALUES ('v1_initial', 'Initial vocabulary content', TRUE);

-- Create default admin user (password: admin123 - CHANGE IN PRODUCTION!)
-- bcrypt hash of 'admin123': $2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eX7L7kztK5dC
INSERT INTO users (username, password, is_admin)
VALUES ('admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eX7L7kztK5dC', TRUE);
