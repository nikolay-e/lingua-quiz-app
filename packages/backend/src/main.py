#!/usr/bin/env python3
import base64
import datetime
import logging
import os

import bcrypt
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
from pydantic import BaseModel, Field, ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from tts_service import TTSService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("POSTGRES_DB", "linguaquiz_db")
DB_USER = os.getenv("POSTGRES_USER", "linguaquiz_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set - never use default secrets in production!")
JWT_EXPIRES_HOURS = int(os.getenv("JWT_EXPIRES_HOURS", "24"))
JWT_EXPIRES_IN = f"{JWT_EXPIRES_HOURS}h"
PORT = int(os.getenv("PORT", 9000))
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,https://lingua-quiz.nikolay-eremeev.com,https://test-lingua-quiz.nikolay-eremeev.com",
).split(",")
if "*" in CORS_ALLOWED_ORIGINS:
    logger.warning("CORS is open to all origins (*) - this is insecure for production!")

DB_POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "5"))
DB_POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "10"))

app = FastAPI(
    title="LinguaQuiz API",
    description="Language learning quiz backend with automated spaced repetition",
    version="3.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    permissions_policy = "geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()"
    response.headers["Permissions-Policy"] = permissions_policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response


limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)


class UserRegistration(UserBase):
    password: str = Field(..., min_length=8, max_length=128)


class UserLogin(UserBase):
    password: str


class UserResponse(BaseModel):
    id: int
    username: str


class TokenResponse(BaseModel):
    token: str
    expires_in: str = "24h"
    user: UserResponse


class WordPairResponse(BaseModel):
    source_text: str = Field(alias="sourceText")
    source_lang: str = Field(alias="sourceLang")
    target_text: str = Field(alias="targetText")
    target_lang: str = Field(alias="targetLang")
    list_name: str = Field(alias="listName")
    source_example: str | None = Field(alias="sourceExample")
    target_example: str | None = Field(alias="targetExample")

    class Config:
        populate_by_name = True


class WordListResponse(BaseModel):
    list_name: str = Field(alias="listName")
    word_count: int = Field(alias="wordCount")

    class Config:
        populate_by_name = True


class UserProgressResponse(BaseModel):
    source_text: str = Field(alias="sourceText")
    source_lang: str = Field(alias="sourceLang")
    level: int
    correct_count: int = Field(alias="correctCount")
    error_count: int = Field(alias="errorCount")
    last_practiced: str | None = Field(alias="lastPracticed")

    class Config:
        populate_by_name = True


class ProgressUpdateRequest(BaseModel):
    source_text: str = Field(alias="sourceText")
    source_lang: str = Field(alias="sourceLang")
    level: int = Field(..., ge=0, le=5)
    correct_count: int = Field(alias="correctCount", ge=0)
    error_count: int = Field(alias="errorCount", ge=0)

    class Config:
        populate_by_name = True


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: str = Field(..., pattern="^(en|de|ru|es)$")


class TTSResponse(BaseModel):
    audio_data: str = Field(alias="audioData")
    content_type: str = Field(alias="contentType", default="audio/mpeg")
    text: str
    language: str

    class Config:
        populate_by_name = True


class TTSLanguagesResponse(BaseModel):
    available: bool
    supported_languages: list[str] = Field(alias="supportedLanguages")

    class Config:
        populate_by_name = True


class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str


class VersionResponse(BaseModel):
    version: str


class ErrorResponse(BaseModel):
    error: str


db_pool = SimpleConnectionPool(
    DB_POOL_MIN_SIZE,
    DB_POOL_MAX_SIZE,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
)

tts_service = TTSService(db_pool)


def snake_to_camel(snake_str):
    components = snake_str.split("_")
    return components[0] + "".join(x.title() for x in components[1:])


def convert_keys_to_camel_case(obj):
    if isinstance(obj, list):
        return [convert_keys_to_camel_case(item) for item in obj]
    if isinstance(obj, dict):
        return {snake_to_camel(k): convert_keys_to_camel_case(v) for k, v in obj.items()}
    return obj


def get_db():
    return db_pool.getconn()


def put_db(conn):
    db_pool.putconn(conn)


def query_db(query, args=(), one=False):
    query_upper = query.strip().upper()
    write_keywords = [
        "INSERT",
        "UPDATE",
        "DELETE",
        "CREATE",
        "DROP",
        "ALTER",
        "TRUNCATE",
    ]
    for keyword in write_keywords:
        if query_upper.startswith(keyword):
            raise ValueError(
                f"query_db() detected a write operation starting with '{keyword}'. "
                f"Use execute_write_transaction() instead to ensure data is committed."
            )

    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            rv = cur.fetchall()
            return (rv[0] if rv else None) if one else rv
    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    except Exception as e:
        logger.error(f"Database query error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                logger.critical(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except Exception:
                    pass


def execute_write_transaction(query, args=(), fetch_results=False, one=False):
    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)

            if fetch_results:
                rv = cur.fetchall()
                conn.commit()
                return (rv[0] if rv else None) if one else rv
            row_count = cur.rowcount
            conn.commit()
            return row_count
    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        raise
    except Exception as e:
        logger.error(f"Database execute error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                logger.critical(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except Exception:
                    pass


security = HTTPBearer()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRES_HOURS)
    to_encode.update({"exp": expire, "iat": datetime.datetime.utcnow()})
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("userId")
        username = payload.get("sub")
        if user_id is None or username is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
        return {"user_id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token has expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    try:
        query_db("SELECT 1", one=True)
        return HealthResponse(
            status="ok",
            database="connected",
            timestamp=datetime.datetime.utcnow().isoformat(),
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed",
        )


@app.get("/api/version", response_model=VersionResponse, tags=["Health"])
async def get_version():
    return VersionResponse(version="3.0.0")


@app.post(
    "/api/auth/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Authentication"],
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
            "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id",
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
        logger.info(f"Successfully created user {user_data.username} with id {user_id}")

        token = create_access_token(data={"userId": user_id, "sub": user_data.username})

        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRES_IN,
            user=UserResponse(id=user_id, username=user_data.username),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed",
        )


@app.post("/api/auth/login", response_model=TokenResponse, tags=["Authentication"])
@limiter.limit("100/15minutes")
async def login_user(request: Request, user_data: UserLogin):
    logger.info(f"Login attempt for user: {user_data.username}")
    try:
        user = query_db(
            "SELECT id, username, password FROM users WHERE username = %s",
            (user_data.username,),
            one=True,
        )

        if not user or not verify_password(user_data.password, user["password"]):
            logger.warning(f"Invalid login attempt for user: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password",
            )

        token = create_access_token(data={"userId": user["id"], "sub": user["username"]})
        logger.info(f"Successful login for user: {user_data.username}")

        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRES_IN,
            user=UserResponse(id=user["id"], username=user["username"]),
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Login failed")


@app.delete("/api/auth/delete-account", tags=["Authentication"])
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


@app.get("/api/user/profile", response_model=UserResponse, tags=["User"])
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    try:
        return UserResponse(id=current_user["user_id"], username=current_user["username"])
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user profile",
        )


@app.get("/api/word-lists", response_model=list[WordListResponse], tags=["Word Lists"])
async def get_word_lists(current_user: dict = Depends(get_current_user)):
    logger.debug(f"Fetching word lists for user: {current_user['username']}")
    try:
        lists = query_db(
            """SELECT list_name, COUNT(*) as word_count
               FROM word_pairs
               GROUP BY list_name
               ORDER BY list_name"""
        )
        return [convert_keys_to_camel_case(dict(item)) for item in lists]

    except Exception as e:
        logger.error(f"Error fetching word lists: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word lists",
        )


@app.get("/api/word-pairs", response_model=list[WordPairResponse], tags=["Word Pairs"])
async def get_word_pairs(list_name: str, current_user: dict = Depends(get_current_user)):
    try:
        word_pairs = query_db(
            """SELECT source_text, source_lang, target_text, target_lang,
                      list_name, source_example, target_example
               FROM word_pairs
               WHERE list_name = %s
               ORDER BY source_text""",
            (list_name,),
        )

        return [convert_keys_to_camel_case(dict(wp)) for wp in word_pairs]

    except Exception as e:
        logger.error(f"Error fetching word pairs for list {list_name}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word pairs",
        )


@app.get("/api/user/progress", response_model=list[UserProgressResponse], tags=["Progress"])
async def get_user_progress(list_name: str | None = None, current_user: dict = Depends(get_current_user)):
    try:
        if list_name:
            progress = query_db(
                """SELECT up.source_text, up.source_lang, up.level,
                          up.correct_count, up.error_count, up.last_practiced
                   FROM user_progress up
                   JOIN word_pairs wp ON up.source_text = wp.source_text
                                      AND up.source_lang = wp.source_lang
                   WHERE up.user_id = %s AND wp.list_name = %s
                   ORDER BY up.last_practiced DESC""",
                (current_user["user_id"], list_name),
            )
        else:
            progress = query_db(
                """SELECT source_text, source_lang, level,
                          correct_count, error_count, last_practiced
                   FROM user_progress
                   WHERE user_id = %s
                   ORDER BY last_practiced DESC""",
                (current_user["user_id"],),
            )

        return [convert_keys_to_camel_case(dict(p)) for p in progress]

    except Exception as e:
        logger.error(f"Error fetching user progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch progress",
        )


@app.post("/api/user/progress", tags=["Progress"])
async def update_user_progress(progress_data: ProgressUpdateRequest, current_user: dict = Depends(get_current_user)):
    try:
        execute_write_transaction(
            """INSERT INTO user_progress
               (user_id, source_text, source_lang, level, correct_count, error_count, last_practiced)
               VALUES (%s, %s, %s, %s, %s, %s, NOW())
               ON CONFLICT (user_id, source_text, source_lang)
               DO UPDATE SET
                   level = EXCLUDED.level,
                   correct_count = EXCLUDED.correct_count,
                   error_count = EXCLUDED.error_count,
                   last_practiced = EXCLUDED.last_practiced""",
            (
                current_user["user_id"],
                progress_data.source_text,
                progress_data.source_lang,
                progress_data.level,
                progress_data.correct_count,
                progress_data.error_count,
            ),
        )

        return {"message": "Progress updated successfully"}

    except Exception as e:
        logger.error(f"Error updating progress: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update progress",
        )


@app.post("/api/tts/synthesize", response_model=TTSResponse, tags=["Text-to-Speech"])
@limiter.limit("100/minute")
async def synthesize_speech(
    request: Request,
    tts_data: TTSRequest,
    current_user: dict = Depends(get_current_user),
):
    try:
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


@app.get("/api/tts/languages", response_model=TTSLanguagesResponse, tags=["Text-to-Speech"])
async def get_tts_languages(current_user: dict = Depends(get_current_user)):
    try:
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


@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )


@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(status_code=status.HTTP_404_NOT_FOUND, content={"error": "Resource not found"})


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=PORT)
