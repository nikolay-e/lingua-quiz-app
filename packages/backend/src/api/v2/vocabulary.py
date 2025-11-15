import logging

from core.database import query_db
from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.vocabulary import VocabularyItemResponse, WordListResponse
from utils import convert_keys_to_camel_case

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Vocabulary"])


@router.get("/word-lists", response_model=list[WordListResponse])
async def get_word_lists(current_user: dict = Depends(get_current_user)):
    logger.debug(f"Fetching word lists for user: {current_user['username']}")
    try:
        active_version_id = query_db("SELECT get_active_version_id()", one=True)
        if not active_version_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No active content version found",
            )

        version_id = active_version_id["get_active_version_id"]

        lists = query_db(
            """SELECT list_name, COUNT(*) as word_count
               FROM vocabulary_items
               WHERE version_id = %s AND is_active = TRUE
               GROUP BY list_name
               ORDER BY list_name""",
            (version_id,),
        )
        return [convert_keys_to_camel_case(dict(item)) for item in lists]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word lists: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word lists",
        )


@router.get("/translations", response_model=list[VocabularyItemResponse])
async def get_translations(list_name: str, current_user: dict = Depends(get_current_user)):
    try:
        active_version_id = query_db("SELECT get_active_version_id()", one=True)
        if not active_version_id:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No active content version found",
            )

        version_id = active_version_id["get_active_version_id"]

        translations = query_db(
            """SELECT id, source_text, source_language, target_text, target_language,
                      list_name, source_usage_example, target_usage_example
               FROM vocabulary_items
               WHERE list_name = %s AND version_id = %s AND is_active = TRUE
               ORDER BY source_text""",
            (list_name, version_id),
        )

        result = []
        for t in translations:
            item_dict = dict(t)
            item_dict["id"] = str(item_dict["id"])
            result.append(convert_keys_to_camel_case(item_dict))

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word pairs for list {list_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word pairs",
        )
