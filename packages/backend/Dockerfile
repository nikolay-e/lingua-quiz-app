FROM python:3.13-alpine

WORKDIR /app

# Install PostgreSQL client libraries, curl for health checks, and netcat for db wait
RUN apk add --no-cache postgresql-libs curl netcat-openbsd \
  && apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev

# Copy and install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt && \
    apk --purge del .build-deps

# Copy application and migrations
COPY main.py migrate.py tts_service.py ./
COPY migrations/ ./migrations/

# Set Python optimizations for production
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Copy start script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

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
