import datetime
import hashlib
import secrets

import bcrypt
from core.config import JWT_ACCESS_TOKEN_EXPIRES_MINUTES, JWT_REFRESH_TOKEN_EXPIRES_DAYS, JWT_SECRET
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(minutes=JWT_ACCESS_TOKEN_EXPIRES_MINUTES)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")


def create_refresh_token() -> tuple[str, str, datetime.datetime]:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=JWT_REFRESH_TOKEN_EXPIRES_DAYS)
    return token, token_hash, expires_at


def verify_refresh_token(token: str) -> dict:
    from core.database import query_db

    token_hash = hashlib.sha256(token.encode()).hexdigest()

    token_data = query_db(
        """
        SELECT user_id, expires_at, revoked_at
        FROM refresh_tokens
        WHERE token_hash = %s
        """,
        (token_hash,),
        one=True,
    )

    if not token_data:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    if token_data["revoked_at"] is not None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has been revoked")

    if token_data["expires_at"] < datetime.datetime.utcnow():
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired")

    return {"user_id": token_data["user_id"]}


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("userId")
        username = payload.get("sub")
        is_admin = payload.get("isAdmin", False)

        if user_id is None or username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )

        return {"user_id": user_id, "username": username, "is_admin": is_admin}

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


async def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    from core.database import query_db

    user = query_db(
        "SELECT is_admin FROM users WHERE id = %s",
        (current_user["user_id"],),
        one=True,
    )

    if not user or not user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user
