import logging

from core.database import execute_write_transaction, query_db
from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.progress import ProgressUpdateRequest, UserProgressResponse
from utils import convert_keys_to_camel_case

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/user", tags=["Progress"])


@router.get("/progress", response_model=list[UserProgressResponse])
async def get_user_progress(list_name: str | None = None, current_user: dict = Depends(get_current_user)):
    try:
        if list_name:
            active_version_id = query_db("SELECT get_active_version_id()", one=True)
            if not active_version_id:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="No active content version found",
                )

            version_id = active_version_id["get_active_version_id"]

            progress = query_db(
                """SELECT up.vocabulary_item_id, up.level, up.queue_position,
                          up.correct_count, up.incorrect_count, up.consecutive_correct,
                          up.last_practiced_at as last_practiced,
                          vi.source_text, vi.source_language, vi.target_language
                   FROM user_progress up
                   JOIN vocabulary_items vi ON up.vocabulary_item_id = vi.id
                   WHERE up.user_id = %s AND vi.list_name = %s AND vi.version_id = %s AND vi.is_active = TRUE
                   ORDER BY up.last_practiced_at DESC""",
                (current_user["user_id"], list_name, version_id),
            )
        else:
            progress = query_db(
                """SELECT up.vocabulary_item_id, up.level, up.queue_position,
                          up.correct_count, up.incorrect_count, up.consecutive_correct,
                          up.last_practiced_at as last_practiced,
                          vi.source_text, vi.source_language, vi.target_language
                   FROM user_progress up
                   JOIN vocabulary_items vi ON up.vocabulary_item_id = vi.id
                   WHERE up.user_id = %s
                   ORDER BY up.last_practiced_at DESC""",
                (current_user["user_id"],),
            )

        result = []
        for p in progress:
            item_dict = dict(p)
            item_dict["vocabulary_item_id"] = str(item_dict["vocabulary_item_id"])
            if item_dict.get("last_practiced"):
                item_dict["last_practiced"] = item_dict["last_practiced"].isoformat()
            result.append(convert_keys_to_camel_case(item_dict))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch progress",
        )


@router.post("/progress")
async def save_user_progress(progress_data: ProgressUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        active_version_id = query_db("SELECT get_active_version_id()", one=True)
        if not active_version_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No active content version found",
            )

        version_id = active_version_id["get_active_version_id"]

        vocab_item = query_db(
            """SELECT id FROM vocabulary_items
               WHERE source_text = %s AND source_language = %s AND target_language = %s
               AND version_id = %s AND is_active = TRUE""",
            (progress_data.source_text, progress_data.source_language, progress_data.target_language, version_id),
            one=True,
        )

        if not vocab_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Vocabulary item not found: {progress_data.source_text}",
            )

        vocabulary_item_id = vocab_item["id"]

        execute_write_transaction(
            """INSERT INTO user_progress
               (user_id, vocabulary_item_id, level, queue_position, correct_count, incorrect_count, consecutive_correct, last_practiced_at)
               VALUES (%s, %s, %s, %s, %s, %s, %s, NOW())
               ON CONFLICT (user_id, vocabulary_item_id)
               DO UPDATE SET
                   level = EXCLUDED.level,
                   queue_position = EXCLUDED.queue_position,
                   correct_count = EXCLUDED.correct_count,
                   incorrect_count = EXCLUDED.incorrect_count,
                   consecutive_correct = EXCLUDED.consecutive_correct,
                   last_practiced_at = EXCLUDED.last_practiced_at""",
            (
                current_user["user_id"],
                vocabulary_item_id,
                progress_data.level,
                progress_data.queue_position,
                progress_data.correct_count,
                progress_data.incorrect_count,
                progress_data.consecutive_correct,
            ),
        )

        return {"message": "Progress updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update progress",
        )
