import hashlib
import logging

from core.database import execute_write_transaction, query_db
from core.security import (
    create_access_token,
    create_refresh_token,
    get_current_user,
    hash_password,
    verify_password,
    verify_refresh_token,
)
from fastapi import APIRouter, Depends, HTTPException, Request, status
from schemas.user import RefreshTokenRequest, TokenResponse, UserLogin, UserRegistration, UserResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["Authentication"])
limiter = Limiter(key_func=get_remote_address)


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("100/15minutes")
async def register_user(request: Request, user_data: UserRegistration):
    logger.info(f"Starting registration for user: {user_data.username}")
    try:
        existing_user = query_db("SELECT id FROM users WHERE username = %s", (user_data.username,), one=True)
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists",
            )

        hashed_password = hash_password(user_data.password)
        result = execute_write_transaction(
            "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id, is_admin",
            (user_data.username, hashed_password),
            fetch_results=True,
            one=True,
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user",
            )

        user_id = result["id"]
        is_admin = result.get("is_admin", False)
        logger.info(f"Successfully created user {user_data.username} with id {user_id}")

        token = create_access_token(data={"userId": user_id, "sub": user_data.username, "isAdmin": is_admin})

        refresh_token, token_hash, expires_at = create_refresh_token()
        execute_write_transaction(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user_id, token_hash, expires_at),
        )

        return TokenResponse(
            token=token,
            refresh_token=refresh_token,
            expires_in="15m",
            user=UserResponse(id=user_id, username=user_data.username, is_admin=is_admin),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("100/15minutes")
async def login_user(request: Request, user_data: UserLogin):
    logger.info(f"Login attempt for user: {user_data.username}")
    try:
        user = query_db(
            "SELECT id, username, password, is_admin FROM users WHERE username = %s",
            (user_data.username,),
            one=True,
        )

        if not user or not verify_password(user_data.password, user["password"]):
            logger.warning(f"Invalid login attempt for user: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        is_admin = user.get("is_admin", False)
        token = create_access_token(data={"userId": user["id"], "sub": user["username"], "isAdmin": is_admin})

        refresh_token, token_hash, expires_at = create_refresh_token()
        execute_write_transaction(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user["id"], token_hash, expires_at),
        )

        logger.info(f"Successful login for user: {user_data.username}")

        return TokenResponse(
            token=token,
            refresh_token=refresh_token,
            expires_in="15m",
            user=UserResponse(id=user["id"], username=user["username"], is_admin=is_admin),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("100/15minutes")
async def refresh_access_token(request: Request, refresh_request: RefreshTokenRequest):
    logger.info("Access token refresh attempt")
    try:
        user_data = verify_refresh_token(refresh_request.refresh_token)

        user = query_db(
            "SELECT id, username, is_admin FROM users WHERE id = %s",
            (user_data["user_id"],),
            one=True,
        )

        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

        is_admin = user.get("is_admin", False)
        new_access_token = create_access_token(data={"userId": user["id"], "sub": user["username"], "isAdmin": is_admin})

        new_refresh_token, token_hash, expires_at = create_refresh_token()
        old_token_hash = hashlib.sha256(refresh_request.refresh_token.encode()).hexdigest()

        execute_write_transaction(
            "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = %s",
            (old_token_hash,),
        )

        execute_write_transaction(
            "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user["id"], token_hash, expires_at),
        )

        logger.info(f"Access token refreshed for user: {user['username']}")

        return TokenResponse(
            token=new_access_token,
            refresh_token=new_refresh_token,
            expires_in="15m",
            user=UserResponse(id=user["id"], username=user["username"], is_admin=is_admin),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Token refresh error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token refresh failed",
        )


@router.delete("/delete-account")
async def delete_account(current_user: dict = Depends(get_current_user)):
    logger.info(f"Account deletion request for user: {current_user['username']}")
    try:
        result = execute_write_transaction("DELETE FROM users WHERE id = %s", (current_user["user_id"],))

        if result == 0:
            logger.warning(f"Account deletion failed - user not found: {current_user['username']}")
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        logger.info(f"Account successfully deleted for user: {current_user['username']}")
        return {"message": "Account deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Account deletion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account",
        )


@router.get("/profile", response_model=UserResponse)
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    try:
        return UserResponse(
            id=current_user["user_id"],
            username=current_user["username"],
            is_admin=current_user.get("is_admin", False),
        )
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile",
        )
