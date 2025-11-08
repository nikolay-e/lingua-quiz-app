import base64
import hashlib
import logging
import os

from google.cloud import texttospeech
from google.oauth2 import service_account
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)


class TTSService:
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
                self.client = texttospeech.TextToSpeechClient()
                logger.info("TTS client initialized with default credentials")
        except Exception as e:
            logger.error(f"Failed to initialize TTS client: {e}")
            self.client = None

    def is_available(self) -> bool:
        return self.client is not None

    def get_cache_key(self, text: str, language: str) -> str:
        return hashlib.md5(f"{text}_{language}".encode()).hexdigest()

    def _get_from_cache_validated(self, cache_key: str, text: str) -> tuple[bytes | None, bool]:
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
                        return audio_data, True
                    if is_valid:
                        return None, True
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
                    return True
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
        if not self.is_available() or not text.strip():
            return None

        text = text.strip()
        if len(text) > 500:
            return None

        cache_key = self.get_cache_key(text, language)

        audio_content, is_valid_text = self._get_from_cache_validated(cache_key, text)

        if not is_valid_text:
            return None

        if audio_content:
            return audio_content

        voice_config = self.voice_configs.get(language)
        if not voice_config:
            logger.error(f"Language '{language}' not supported for TTS")
            return None

        try:
            response = self.client.synthesize_speech(
                input=texttospeech.SynthesisInput(text=text),
                voice=texttospeech.VoiceSelectionParams(
                    language_code=voice_config["language_code"],
                    name=voice_config["name"],
                ),
                audio_config=texttospeech.AudioConfig(
                    audio_encoding=texttospeech.AudioEncoding.MP3,
                    speaking_rate=0.9,
                    effects_profile_id=["telephony-class-application"],
                ),
            )

            audio_content = response.audio_content

            self._save_to_cache_validated(cache_key, audio_content, text, language)

            return audio_content

        except Exception as e:
            logger.error(f"TTS synthesis failed for '{text}' in {language}: {e}")
            return None

    def get_supported_languages(self) -> list:
        return list(self.voice_configs.keys())

    def get_cache_stats(self) -> dict:
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
