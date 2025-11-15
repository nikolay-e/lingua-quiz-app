import logging
import os

logger = logging.getLogger(__name__)

# Database configuration
DB_HOST = os.getenv("DB_HOST", "localhost")
DB_PORT = int(os.getenv("DB_PORT", 5432))
DB_NAME = os.getenv("POSTGRES_DB", "linguaquiz_db")
DB_USER = os.getenv("POSTGRES_USER", "linguaquiz_user")
DB_PASSWORD = os.getenv("POSTGRES_PASSWORD", "password")
DB_POOL_MIN_SIZE = int(os.getenv("DB_POOL_MIN_SIZE", "5"))
DB_POOL_MAX_SIZE = int(os.getenv("DB_POOL_MAX_SIZE", "10"))

# JWT configuration
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set")
JWT_ACCESS_TOKEN_EXPIRES_MINUTES = int(os.getenv("JWT_ACCESS_TOKEN_EXPIRES_MINUTES", "15"))
JWT_REFRESH_TOKEN_EXPIRES_DAYS = int(os.getenv("JWT_REFRESH_TOKEN_EXPIRES_DAYS", "7"))
JWT_EXPIRES_IN = f"{JWT_ACCESS_TOKEN_EXPIRES_MINUTES}m"

# Server configuration
PORT = int(os.getenv("PORT", 9000))

# CORS configuration
CORS_ALLOWED_ORIGINS = os.getenv(
    "CORS_ALLOWED_ORIGINS",
    "http://localhost:8080,http://localhost:5173,https://lingua-quiz.nikolay-eremeev.com,https://test-lingua-quiz.nikolay-eremeev.com",
).split(",")

if "*" in CORS_ALLOWED_ORIGINS:
    logger.warning("CORS is open to all origins (*) - this is insecure for production!")
