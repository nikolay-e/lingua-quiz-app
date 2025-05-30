-- TTS Cache Table Migration
-- Creates a table to cache TTS audio data to avoid repeated API calls

CREATE TABLE IF NOT EXISTS tts_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(32) UNIQUE NOT NULL,
    text_content TEXT NOT NULL,
    language VARCHAR(50) NOT NULL,
    audio_data BYTEA NOT NULL,
    file_size INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_tts_cache_key ON tts_cache (cache_key);
CREATE INDEX IF NOT EXISTS idx_tts_cache_created_at ON tts_cache (created_at);
CREATE INDEX IF NOT EXISTS idx_tts_cache_last_accessed ON tts_cache (last_accessed_at);

-- Optional: Add comment for documentation
COMMENT ON TABLE tts_cache IS 'Caches TTS audio data to avoid repeated Google Cloud TTS API calls';
COMMENT ON COLUMN tts_cache.cache_key IS 'MD5 hash of text + language for unique identification';
COMMENT ON COLUMN tts_cache.audio_data IS 'Binary audio data in MP3 format';