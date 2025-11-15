import base64
import logging

from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, Request, status
from schemas.tts import TTSLanguagesResponse, TTSRequest, TTSResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/tts", tags=["Text-to-Speech"])
limiter = Limiter(key_func=get_remote_address)


def get_tts_service():
    from core.database import db_pool
    from tts_service import TTSService

    return TTSService(db_pool)


@router.post("/synthesize", response_model=TTSResponse)
@limiter.limit("100/minute")
async def synthesize_speech(
    request: Request,
    tts_data: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
        tts_service = get_tts_service()
        audio_data = tts_service.synthesize_speech(tts_data.text, tts_data.language)

        if not audio_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to synthesize speech",
            )

        audio_data_b64 = base64.b64encode(audio_data).decode("utf-8")

        return TTSResponse(
            audio_data=audio_data_b64,
            content_type="audio/mpeg",
            text=tts_data.text,
            language=tts_data.language,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Speech synthesis failed",
        )


@router.get("/languages", response_model=TTSLanguagesResponse)
async def get_tts_languages(current_user: dict = Depends(get_current_user)):
    try:
        tts_service = get_tts_service()
        return TTSLanguagesResponse(
            available=tts_service.is_available(),
            supported_languages=tts_service.get_supported_languages(),
        )

    except Exception as e:
        logger.error(f"Error getting TTS languages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get TTS languages",
        )
