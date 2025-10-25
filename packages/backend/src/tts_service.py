"""
Text-to-Speech Service with Google Cloud TTS and Database Caching
Provides audio synthesis for quiz words with intelligent caching
"""

import base64
import hashlib
import logging
import os

from google.cloud import texttospeech
from google.oauth2 import service_account
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class TTSService:
    """Text-to-Speech service with Google Cloud TTS and database caching"""

    def __init__(self, db_pool):
        self.client = None
        self.db_pool = db_pool
        self.voice_configs = {
            "English": {"language_code": "en-US", "name": "en-US-Standard-A"},
            "German": {"language_code": "de-DE", "name": "de-DE-Standard-A"},
            "Russian": {"language_code": "ru-RU", "name": "ru-RU-Standard-A"},
            "Spanish": {"language_code": "es-ES", "name": "es-ES-Standard-A"},
        }
        self._initialize_client()

    def _initialize_client(self):
        """Initialize Google Cloud TTS client with credentials"""
        try:
            credentials_b64 = os.getenv("GOOGLE_CLOUD_CREDENTIALS_B64")
            if credentials_b64:
                import json

                credentials_json = base64.b64decode(credentials_b64).decode("utf-8")
                credentials_info = json.loads(credentials_json)
                credentials = service_account.Credentials.from_service_account_info(credentials_info)
                self.client = texttospeech.TextToSpeechClient(credentials=credentials)
                logger.info("TTS client initialized with service account credentials")
            else:
                # Try default credentials (for local development)
                self.client = texttospeech.TextToSpeechClient()
                logger.info("TTS client initialized with default credentials")
        except Exception as e:
            logger.error(f"Failed to initialize TTS client: {e}")
            self.client = None

    def is_available(self) -> bool:
        """Check if TTS service is available"""
        return self.client is not None

    def get_cache_key(self, text: str, language: str) -> str:
        """Generate MD5 hash for cache key"""
        return hashlib.md5(f"{text}_{language}".encode()).hexdigest()

    def _get_from_cache_validated(self, cache_key: str, text: str) -> tuple[bytes | None, bool]:
        """Retrieve audio data from database cache with text validation"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT * FROM get_tts_cache_entry_validated(%s, %s)",
                    (cache_key, text),
                )
                result = cur.fetchone()

                if result:
                    conn.commit()
                    is_valid = result["is_valid_text"]
                    audio_data = bytes(result["audio_data"]) if result["audio_data"] else None

                    if is_valid and audio_data:
                        logger.debug(f"TTS cache hit for key: {cache_key}")
                        return audio_data, True
                    if is_valid:
                        logger.debug(f"TTS cache miss for valid text: {cache_key}")
                        return None, True
                    logger.debug(f"TTS text not allowed: {text[:30]}...")
                    return None, False

        except Exception as e:
            logger.error(f"Cache read error: {e}")
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
        finally:
            if conn:
                self.db_pool.putconn(conn)
        return None, False

    def _save_to_cache_validated(self, cache_key: str, audio_content: bytes, text: str, language: str) -> bool:
        """Save audio data to database cache with validation"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT save_tts_cache_entry_validated(%s, %s, %s, %s, %s)",
                    (cache_key, text, language, audio_content, len(audio_content)),
                )
                result = cur.fetchone()[0]
                conn.commit()

                if result:
                    logger.debug(f"TTS cached: {language} - {text[:30]}... (size: {len(audio_content)} bytes)")
                    return True
                logger.warning(f"TTS cache rejected - text not in database: {text[:30]}...")
                return False

        except Exception as e:
            logger.error(f"Cache save error: {e}")
            if conn:
                try:
                    conn.rollback()
                except Exception:
                    pass
            return False
        finally:
            if conn:
                self.db_pool.putconn(conn)
        return False

    def synthesize_speech(self, text: str, language: str) -> bytes | None:
        """
        Synthesize speech for given text and language.
        Only works with text that exists in database words/phrases.
        Returns cached audio if available, otherwise generates new audio.
        """
        if not self.is_available() or not text.strip():
            logger.warning("TTS service unavailable or empty text provided")
            return None

        # Clean and validate text
        text = text.strip()
        if len(text) > 500:
            logger.warning(f"Text too long for TTS: {len(text)} characters")
            return None

        cache_key = self.get_cache_key(text, language)

        # Check cache first with built-in validation
        audio_content, is_valid_text = self._get_from_cache_validated(cache_key, text)

        # If text is not in database, reject immediately
        if not is_valid_text:
            logger.warning(f"TTS rejected - text not found in database: {text[:30]}...")
            return None

        # Return cached audio if available
        if audio_content:
            return audio_content

        # Validate language support
        voice_config = self.voice_configs.get(language)
        if not voice_config:
            logger.error(f"Language '{language}' not supported for TTS")
            return None

        # Synthesize new audio (only for valid database text)
        try:
            logger.info(f"Synthesizing TTS for database text: {language} - {text[:30]}...")

            response = self.client.synthesize_speech(
                input=texttospeech.SynthesisInput(text=text),
                voice=texttospeech.VoiceSelectionParams(
                    language_code=voice_config["language_code"],
                    name=voice_config["name"],
                ),
                audio_config=texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=0.9,  # Slightly slower for language learning
                    effects_profile_id=["telephony-class-application"],  # Better quality
                ),
            )

            audio_content = response.audio_content

            # Save to cache (will double-check validation)
            saved = self._save_to_cache_validated(cache_key, audio_content, text, language)
            if not saved:
                logger.error("Failed to cache TTS - validation failed during save")

            logger.info(f"TTS synthesis completed: {len(audio_content)} bytes")
            return audio_content

        except Exception as e:
            logger.error(f"TTS synthesis failed for '{text}' in {language}: {e}")
            return None

    def get_supported_languages(self) -> list:
        """Get list of supported languages"""
        return list(self.voice_configs.keys())

    def get_cache_stats(self) -> dict:
        """Get cache statistics (utility method for monitoring)"""
        conn = None
        try:
            conn = self.db_pool.getconn()
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT * FROM get_tts_cache_stats()")
                stats = cur.fetchone()
                return dict(stats) if stats else {}
        except Exception as e:
            logger.error(f"Cache stats error: {e}")
            return {}
        finally:
            if conn:
                self.db_pool.putconn(conn)
