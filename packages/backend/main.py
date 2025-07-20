#!/usr/bin/env python3
"""
LinguaQuiz FastAPI Backend
Single-file implementation with all business logic, validation, and documentation
Migrated from Flask to FastAPI for type safety, automatic validation, and API docs
"""

# =================================================================
# 1. Imports and App Initialization
# =================================================================
import os
import datetime
import functools
import base64
import logging
from typing import List, Optional, Dict, Any, Union

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import bcrypt
import jwt

from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, ValidationError, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from tts_service import TTSService

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# =================================================================
# 2. Configuration
# =================================================================
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('POSTGRES_DB', 'linguaquiz_db')
DB_USER = os.getenv('POSTGRES_USER', 'linguaquiz_user')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'password')
JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set - never use default secrets in production!")
JWT_EXPIRES_IN = os.getenv('JWT_EXPIRES_IN', '24h')
JWT_EXPIRES_HOURS = int(os.getenv('JWT_EXPIRES_HOURS', '24'))
PORT = int(os.getenv('PORT', 9000))
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS',
    'http://localhost:8080,http://localhost:5173,https://lingua-quiz.nikolay-eremeev.com,https://test-lingua-quiz.nikolay-eremeev.com'
).split(',')
if '*' in CORS_ALLOWED_ORIGINS:
    logger.warning("CORS is open to all origins (*) - this is insecure for production!")

# Database pool configuration
DB_POOL_MIN_SIZE = int(os.getenv('DB_POOL_MIN_SIZE', '5'))
DB_POOL_MAX_SIZE = int(os.getenv('DB_POOL_MAX_SIZE', '10'))

# =================================================================
# 3. FastAPI App Initialization
# =================================================================
app = FastAPI(
    title="LinguaQuiz API",
    description="Language learning quiz backend with automated spaced repetition",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to all responses"""
    response = await call_next(request)

    # Content Security Policy (CSP) - prevents XSS and code injection
    csp_policy = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com; "
        "img-src 'self' data: blob:; "
        "connect-src 'self' https://lingua-quiz.nikolay-eremeev.com https://test-lingua-quiz.nikolay-eremeev.com; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "form-action 'self'; "
        "frame-ancestors 'none';"
    )
    response.headers["Content-Security-Policy"] = csp_policy

    # X-Frame-Options - prevents clickjacking
    response.headers["X-Frame-Options"] = "DENY"

    # X-Content-Type-Options - prevents MIME type sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"

    # Strict-Transport-Security (HSTS) - enforces HTTPS
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"

    # Cross-Origin-Embedder-Policy - helps mitigate Spectre attacks
    response.headers["Cross-Origin-Embedder-Policy"] = "credentialless"

    # Cross-Origin-Opener-Policy - provides isolation
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"

    # Permissions Policy - controls browser features
    permissions_policy = (
        "geolocation=(), "
        "microphone=(), "
        "camera=(), "
        "payment=(), "
        "usb=(), "
        "magnetometer=(), "
        "gyroscope=(), "
        "accelerometer=()"
    )
    response.headers["Permissions-Policy"] = permissions_policy

    # Referrer Policy - controls referrer information
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    # Cache control for dynamic content
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    return response

# Rate limiting
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# =================================================================
# 4. Pydantic Models (Data Contracts & Validation)
# =================================================================
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

class WordSetResponse(BaseModel):
    id: int
    name: str
    created_at: str = Field(alias="createdAt")
    updated_at: str = Field(alias="updatedAt")

    class Config:
        populate_by_name = True

class WordResponse(BaseModel):
    translation_id: int = Field(alias="translationId")
    source_word_id: int = Field(alias="sourceWordId")
    target_word_id: int = Field(alias="targetWordId")
    source_word: str = Field(alias="sourceWord")
    target_word: str = Field(alias="targetWord")
    source_language: str = Field(alias="sourceLanguage")
    target_language: str = Field(alias="targetLanguage")
    source_example: Optional[str] = Field(alias="sourceExample")
    target_example: Optional[str] = Field(alias="targetExample")

    class Config:
        populate_by_name = True

class WordSetWithWordsResponse(WordSetResponse):
    words: List[WordResponse]

class UserWordSetRequest(BaseModel):
    word_list_name: str = Field(alias="wordListName")

    class Config:
        populate_by_name = True

class UserWordSetResponse(BaseModel):
    word_pair_id: int = Field(alias="wordPairId")
    source_word: str = Field(alias="sourceWord")
    target_word: str = Field(alias="targetWord")
    source_language: str = Field(alias="sourceLanguage")
    target_language: str = Field(alias="targetLanguage")
    source_word_usage_example: Optional[str] = Field(alias="sourceWordUsageExample")
    target_word_usage_example: Optional[str] = Field(alias="targetWordUsageExample")
    status: Optional[str] = None

    class Config:
        populate_by_name = True

class UserWordSetStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(LEVEL_0|LEVEL_1|LEVEL_2|LEVEL_3|LEVEL_4|LEVEL_5)$")
    word_pair_ids: List[int] = Field(alias="wordPairIds")

    class Config:
        populate_by_name = True

class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=500)
    language: str = Field(..., pattern="^(German|Russian|Spanish)$")

class TTSResponse(BaseModel):
    audio_data: str = Field(alias="audioData")
    content_type: str = Field(alias="contentType", default="audio/mpeg")
    text: str
    language: str

    class Config:
        populate_by_name = True

class TTSLanguagesResponse(BaseModel):
    available: bool
    supported_languages: List[str] = Field(alias="supportedLanguages")

    class Config:
        populate_by_name = True

# Answer comparison models removed - logic moved to @linguaquiz/core

class HealthResponse(BaseModel):
    status: str
    database: str
    timestamp: str

class ErrorResponse(BaseModel):
    error: str

class UserLevelResponse(BaseModel):
    currentLevel: str

class UserLevelUpdateRequest(BaseModel):
    currentLevel: str

class UserLevelUpdateResponse(BaseModel):
    message: str
    currentLevel: str

# =================================================================
# 5. Database Connection & Utilities
# =================================================================
# Database pool
db_pool = SimpleConnectionPool(
    DB_POOL_MIN_SIZE,
    DB_POOL_MAX_SIZE,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

# TTS service
tts_service = TTSService(db_pool)

# Helper functions
def snake_to_camel(snake_str):
    """Convert snake_case to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def convert_keys_to_camel_case(obj):
    """Convert all keys in dict/list from snake_case to camelCase"""
    if isinstance(obj, list):
        return [convert_keys_to_camel_case(item) for item in obj]
    elif isinstance(obj, dict):
        return {snake_to_camel(k): convert_keys_to_camel_case(v) for k, v in obj.items()}
    else:
        return obj

# Database helpers
def get_db():
    return db_pool.getconn()

def put_db(conn):
    db_pool.putconn(conn)

def query_db(query, args=(), one=False):
    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            # Always fetch results first (even for write operations with RETURNING)
            rv = cur.fetchall()

            # Determine if this is a write operation and commit if needed
            is_write_operation = query.strip().upper().startswith(('INSERT', 'UPDATE', 'DELETE'))
            if is_write_operation:
                logger.info(f"Committing transaction for query: {query[:50]}...")
                conn.commit()
                logger.info("Transaction committed successfully")

            return (rv[0] if rv else None) if one else rv
    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass
        raise
    except Exception as e:
        logger.error(f"Database query error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
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
                except:
                    pass

def execute_db(query, args=()):
    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            conn.commit()
            return cur.rowcount
    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        raise
    except Exception as e:
        logger.error(f"Database execute error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
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
                except:
                    pass

# =================================================================
# 6. Security & Dependencies
# =================================================================
security = HTTPBearer()

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRES_HOURS)
    to_encode.update({
        "exp": expire,
        "iat": datetime.datetime.utcnow()
    })
    return jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=['HS256'])
        user_id = payload.get('userId')
        username = payload.get('sub')
        if user_id is None or username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )
        return {"user_id": user_id, "username": username}
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

# =================================================================
# 7. API Routes
# =================================================================

# Health check
@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check API and database connectivity"""
    try:
        # Test database connection
        query_db("SELECT 1", one=True)
        return HealthResponse(
            status="ok",
            database="connected",
            timestamp=datetime.datetime.utcnow().isoformat()
        )
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection failed"
        )

# Authentication routes
@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED, tags=["Authentication"])
@limiter.limit("100/15minutes")
async def register_user(request: Request, user_data: UserRegistration):
    """Register a new user account"""
    logger.info(f"Starting registration for user: {user_data.username}")
    try:
        # Check if user already exists
        existing_user = query_db(
            "SELECT id FROM users WHERE username = %s",
            (user_data.username,),
            one=True
        )
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        # Hash password and create user
        hashed_password = hash_password(user_data.password)
        result = query_db(
            "INSERT INTO users (username, password) VALUES (%s, %s) RETURNING id",
            (user_data.username, hashed_password),
            one=True
        )

        if not result:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create user"
            )

        user_id = result['id']
        logger.info(f"Successfully created user {user_data.username} with id {user_id}")

        # Create access token
        token = create_access_token(data={"userId": user_id, "sub": user_data.username})

        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRES_IN,
            user=UserResponse(id=user_id, username=user_data.username)
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Registration error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed"
        )

@app.post("/api/auth/login", response_model=TokenResponse, tags=["Authentication"])
@limiter.limit("100/15minutes")
async def login_user(request: Request, user_data: UserLogin):
    """Authenticate user and return access token"""
    logger.info(f"Login attempt for user: {user_data.username}")
    try:
        # Get user from database
        user = query_db(
            "SELECT id, username, password FROM users WHERE username = %s",
            (user_data.username,),
            one=True
        )

        if not user or not verify_password(user_data.password, user['password']):
            logger.warning(f"Invalid login attempt for user: {user_data.username}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid username or password"
            )

        # Create access token
        token = create_access_token(data={"userId": user['id'], "sub": user['username']})
        logger.info(f"Successful login for user: {user_data.username}")

        return TokenResponse(
            token=token,
            expires_in=JWT_EXPIRES_IN,
            user=UserResponse(id=user['id'], username=user['username'])
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Login failed"
        )

@app.delete("/api/auth/delete-account", tags=["Authentication"])
async def delete_account(current_user: dict = Depends(get_current_user)):
    """Delete the current user's account"""
    logger.info(f"Account deletion request for user: {current_user['username']}")
    try:
        result = execute_db(
            "DELETE FROM users WHERE id = %s",
            (current_user['user_id'],)
        )

        if result == 0:
            logger.warning(f"Account deletion failed - user not found: {current_user['username']}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        logger.info(f"Account successfully deleted for user: {current_user['username']}")
        return {"message": "Account deleted successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Account deletion error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete account"
        )

# User Level routes
@app.get("/api/user/current-level", response_model=UserLevelResponse, tags=["User"])
async def get_current_level(current_user: dict = Depends(get_current_user)):
    """Get the current level for the authenticated user"""
    try:
        user = query_db(
            'SELECT current_level FROM users WHERE id = %s',
            (current_user['user_id'],),
            one=True
        )

        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserLevelResponse(currentLevel=user['current_level'])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching current level: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch current level"
        )

@app.post("/api/user/current-level", response_model=UserLevelUpdateResponse, tags=["User"])
async def update_current_level(
    level_data: UserLevelUpdateRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update the current level for the authenticated user"""
    try:
        # Validate level value
        valid_levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']
        if level_data.currentLevel not in valid_levels:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid level value. Must be one of: {', '.join(valid_levels)}"
            )

        # Update user level
        result = execute_db(
            'UPDATE users SET current_level = %s::translation_status WHERE id = %s',
            (level_data.currentLevel, current_user['user_id'])
        )

        if result == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        return UserLevelUpdateResponse(
            message="Current level updated successfully",
            currentLevel=level_data.currentLevel
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating current level: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update current level"
        )

# Word Sets routes
@app.get("/api/word-sets", response_model=List[WordSetResponse], tags=["Word Sets"])
async def get_word_sets(current_user: dict = Depends(get_current_user)):
    """Get all available word sets"""
    logger.debug(f"Fetching word sets for user: {current_user['username']}")
    try:
        word_sets = query_db("SELECT * FROM get_word_lists()")
        return [convert_keys_to_camel_case(dict(ws)) for ws in word_sets]

    except Exception as e:
        logger.error(f"Error fetching word sets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word sets"
        )

@app.get("/api/word-sets/user", response_model=List[UserWordSetResponse], tags=["Word Sets"])
async def get_user_word_sets(
    word_list_name: str,
    current_user: dict = Depends(get_current_user)
):
    """Get user-specific word sets with progress status"""
    try:
        user_word_sets = query_db(
            "SELECT * FROM get_user_word_sets(%s, %s)",
            (current_user['user_id'], word_list_name)
        )

        return [convert_keys_to_camel_case(dict(uws)) for uws in user_word_sets]

    except Exception as e:
        logger.error(f"Error fetching user word sets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch user word sets"
        )

@app.get("/api/word-sets/{word_set_id}", response_model=WordSetWithWordsResponse, tags=["Word Sets"])
async def get_word_set(word_set_id: int, current_user: dict = Depends(get_current_user)):
    """Get a specific word set with all its words"""
    try:
        # Get word set info
        word_set = query_db(
            "SELECT * FROM get_word_lists() WHERE id = %s",
            (word_set_id,),
            one=True
        )

        if not word_set:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Word set not found"
            )

        # Get words for this set
        words = query_db(
            """SELECT t.id as translation_id, sw.id as source_word_id, tw.id as target_word_id,
                      sw.text as source_word, tw.text as target_word,
                      sl.name as source_language, tl.name as target_language,
                      sw.usage_example as source_example, tw.usage_example as target_example
               FROM word_list_entries wle
               JOIN translations t ON wle.translation_id = t.id
               JOIN words sw ON t.source_word_id = sw.id
               JOIN words tw ON t.target_word_id = tw.id
               JOIN languages sl ON sw.language_id = sl.id
               JOIN languages tl ON tw.language_id = tl.id
               WHERE wle.word_list_id = %s
               ORDER BY t.id""",
            (word_set_id,)
        )

        result = convert_keys_to_camel_case(dict(word_set))
        result['words'] = [convert_keys_to_camel_case(dict(word)) for word in words]

        return result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching word set {word_set_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch word set"
        )

@app.post("/api/word-sets/user", tags=["Word Sets"])
async def update_user_word_sets(
    update_data: UserWordSetStatusUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update status for multiple user word sets"""
    try:
        # Validate status
        valid_statuses = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5']
        if update_data.status not in valid_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}"
            )

        # Update word sets
        execute_db(
            "SELECT update_user_word_set_status(%s, %s, %s)",
            (current_user['user_id'], update_data.word_pair_ids, update_data.status)
        )

        return {"message": f"Updated {len(update_data.word_pair_ids)} word sets to {update_data.status}"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user word sets: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update word sets"
        )

# TTS routes
@app.post("/api/tts/synthesize", response_model=TTSResponse, tags=["Text-to-Speech"])
@limiter.limit("100/minute")
async def synthesize_speech(
    request: Request,
    tts_data: TTSRequest,
    current_user: dict = Depends(get_current_user)
):
    """Synthesize speech from text"""
    try:
        audio_data = tts_service.synthesize_speech(tts_data.text, tts_data.language)

        if not audio_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to synthesize speech"
            )

        # Convert bytes to base64 string
        audio_data_b64 = base64.b64encode(audio_data).decode('utf-8')

        return TTSResponse(
            audio_data=audio_data_b64,
            content_type="audio/mpeg",
            text=tts_data.text,
            language=tts_data.language
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Speech synthesis failed"
        )

@app.get("/api/tts/languages", response_model=TTSLanguagesResponse, tags=["Text-to-Speech"])
async def get_tts_languages(current_user: dict = Depends(get_current_user)):
    """Get available TTS languages"""
    try:
        return TTSLanguagesResponse(
            available=tts_service.is_available(),
            supported_languages=tts_service.get_supported_languages()
        )

    except Exception as e:
        logger.error(f"Error getting TTS languages: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get TTS languages"
        )

# Note: Answer comparison logic moved to @linguaquiz/core package on frontend

# =================================================================
# 8. Exception Handlers
# =================================================================
@app.exception_handler(ValidationError)
async def validation_exception_handler(request: Request, exc: ValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    return JSONResponse(
        status_code=status.HTTP_404_NOT_FOUND,
        content={"error": "Resource not found"}
    )

@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "Internal server error"}
    )

# =================================================================
# 9. Application Entry Point
# =================================================================
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
