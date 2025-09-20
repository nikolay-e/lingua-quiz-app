# ======================================================================================
# LinguaQuiz Multi-stage Dockerfile (Refactored)
#
# Targets:
#   - backend: Python FastAPI production server
#   - frontend: Nginx server for the Svelte SPA
#   - integration-e2e-tests: Test runner environment
#
# Best Practice: Always use a .dockerignore file to exclude unnecessary files
# from the build context, speeding up the build and reducing image size.
# ======================================================================================


# ======================================================================================
# BASE STAGES
# ======================================================================================

# --- Python Base Stage for Backend & Tests ---
# Establishes a common foundation for both the backend and test stages to reduce duplication.
FROM python:3.13-alpine AS python-base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Install common system dependencies
RUN apk add --no-cache curl netcat-openbsd

# Create a non-root user for security
RUN adduser -D -h /home/appuser appuser
WORKDIR /home/appuser

# ======================================================================================
# BACKEND STAGE
# ======================================================================================
FROM python-base AS backend

# Install build-time and runtime dependencies for the backend
RUN apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev \
    && apk add --no-cache postgresql-libs

# Install Python packages
# This is done as root to install dependencies, then we'll chown the final app directory.
COPY --chown=appuser:appuser packages/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    && apk --purge del .build-deps

# Copy application source code
COPY --chown=appuser:appuser packages/backend/src/main.py packages/backend/src/tts_service.py ./
COPY --chown=appuser:appuser packages/backend/migrate.py ./
COPY --chown=appuser:appuser packages/backend/migrations/ ./migrations/

# Create startup script inline since we don't have external docker/ directory
RUN printf '#!/bin/sh\n\
echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."\n\
while ! nc -z ${DB_HOST} ${DB_PORT}; do\n\
  echo "Database not ready, waiting..."\n\
  sleep 2\n\
done\n\
echo "Database is ready!"\n\
sleep 2\n\
\n\
if [ "$MIGRATE" = "true" ]; then\n\
  echo "Running migrations..."\n\
  python migrate.py\n\
fi\n\
\n\
if [ -n "$UVICORN_WORKERS" ]; then\n\
  WORKERS=$UVICORN_WORKERS\n\
else\n\
  WORKERS=1\n\
fi\n\
echo "Starting uvicorn with $WORKERS workers..."\n\
\n\
exec uvicorn main:app --host 0.0.0.0 --port 9000 --workers $WORKERS --log-level info\n' > ./start.sh \
    && chmod +x ./start.sh \
    && chown appuser:appuser ./start.sh

USER appuser

EXPOSE 9000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:9000/api/health || exit 1

CMD ["./start.sh"]


# ======================================================================================
# FRONTEND BUILDER STAGE
# ======================================================================================
FROM node:24-alpine AS frontend-builder

WORKDIR /app

# For a monorepo, it's often more efficient to install all dependencies at once.
# This leverages caching better if only one package's code changes.
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/frontend/package.json ./packages/frontend/
RUN npm ci

# Copy and build the 'core' library first
COPY packages/core/ ./packages/core/
RUN cd packages/core && npm run test && npm run build

# Copy and build the 'frontend' application
COPY packages/frontend/ ./packages/frontend/
RUN cd packages/frontend && npm run build


# ======================================================================================
# FRONTEND PRODUCTION STAGE
# ======================================================================================
FROM nginx:1.29-alpine AS frontend

# Configure nginx for SPA routing (simplified like working sites)
RUN printf 'server {\n\
    listen 80;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    \n\
    # Basic security\n\
    server_tokens off;\n\
    add_header X-Frame-Options "DENY" always;\n\
    add_header X-Content-Type-Options "nosniff" always;\n\
    \n\
    # SPA routing - serve index.html for all routes\n\
    location / {\n\
        try_files $uri $uri/ /index.html;\n\
    }\n\
    \n\
    # Static assets caching\n\
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {\n\
        expires 1y;\n\
        add_header Cache-Control "public, immutable";\n\
    }\n\
}' > /etc/nginx/conf.d/default.conf

# Copy the built Svelte application from the builder stage
COPY --from=frontend-builder /app/packages/frontend/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


# ======================================================================================
# INTEGRATION AND E2E TESTS STAGE
# ======================================================================================
FROM python-base AS integration-e2e-tests

WORKDIR /home/appuser

# Install test dependencies
COPY --chown=appuser:appuser packages/integration-tests/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy test suite
COPY --chown=appuser:appuser packages/integration-tests/ ./

RUN mkdir -p reports && chown appuser:appuser reports

USER appuser

CMD ["python3", "run_tests.py"]
