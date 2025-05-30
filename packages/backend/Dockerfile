FROM python:3.11-alpine

WORKDIR /app

# Install PostgreSQL client libraries and curl for health checks
RUN apk add --no-cache postgresql-libs curl \
  && apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev

# Copy and install dependencies
COPY requirements.txt requirements-migrate.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-migrate.txt \
  && apk --purge del .build-deps

# Copy application and migrations
COPY app.py migrate.py quiz_logic.py ./
COPY migrations/ ./migrations/

# Run as non-root
RUN adduser -D appuser
USER appuser

EXPOSE 9000

CMD ["python", "app.py"]
