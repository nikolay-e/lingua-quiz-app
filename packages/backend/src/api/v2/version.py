import logging

from core.database import query_db
from core.security import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from schemas.version import ContentVersionResponse
from utils import convert_keys_to_camel_case

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["Content Version"])


@router.get("/content-version", response_model=ContentVersionResponse)
async def get_active_content_version(current_user: dict = Depends(get_current_user)):
    try:
        version = query_db(
            "SELECT id as version_id, version_name, is_active FROM content_versions WHERE is_active = TRUE LIMIT 1",
            one=True,
        )

        if not version:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="No active content version found",
            )

        return convert_keys_to_camel_case(dict(version))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching active content version: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch content version",
        )
