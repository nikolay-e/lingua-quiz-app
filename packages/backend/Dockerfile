FROM python:3.11-alpine

WORKDIR /app

# Install PostgreSQL client libraries, curl for health checks, and netcat for db wait
RUN apk add --no-cache postgresql-libs curl netcat-openbsd \
  && apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev

# Copy and install dependencies with gunicorn
COPY requirements.txt requirements-migrate.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-migrate.txt && \
    pip install --no-cache-dir gunicorn && \
    apk --purge del .build-deps

# Copy application and migrations
COPY app.py migrate.py tts_service.py ./
COPY migrations/ ./migrations/

# Set Python optimizations for production
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Create start script with db wait and proper worker calculation
RUN printf '#!/bin/sh\n\
# Wait for database to be ready\n\
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
# Calculate workers with a lower cap for database connections\n\
# Each worker gets its own connection pool, so we need to limit workers\n\
WORKERS=$(python -c "import multiprocessing; print(min(multiprocessing.cpu_count() + 1, 4))")\n\
echo "Starting gunicorn with $WORKERS workers..."\n\
\n\
# Set rate limiter to use memory:// to suppress warning\n\
export RATELIMIT_STORAGE_URL=memory://\n\
\n\
exec gunicorn --bind 0.0.0.0:9000 --workers $WORKERS --timeout 30 --access-logfile - --error-logfile - app:app\n' > /app/start.sh && \
    chmod +x /app/start.sh

# Run as non-root
RUN adduser -D appuser && \
    chown -R appuser:appuser /app
USER appuser

EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:9000/api/health || exit 1

# Use the start script
CMD ["/bin/sh", "/app/start.sh"]