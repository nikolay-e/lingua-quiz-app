FROM python:3.11-alpine

WORKDIR /app

# Install PostgreSQL client libraries
RUN apk add --no-cache postgresql-libs \
  && apk add --no-cache --virtual .build-deps gcc musl-dev postgresql-dev

# Copy and install dependencies
COPY packages/backend/requirements.txt packages/backend/requirements-migrate.txt ./
RUN pip install --no-cache-dir -r requirements.txt -r requirements-migrate.txt \
  && apk --purge del .build-deps

# Copy application and migrations
COPY packages/backend/app.py packages/backend/migrate.py ./
COPY packages/backend/migrations/ ./migrations/

# Run as non-root
RUN adduser -D appuser
USER appuser

EXPOSE 9000

CMD ["python", "app.py"]
