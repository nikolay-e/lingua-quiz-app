#!/bin/sh
set -e # Exit immediately if a command exits with a non-zero status

echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
while ! nc -z ${DB_HOST} ${DB_PORT}; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"
sleep 2

MIGRATE="${MIGRATE:-false}"
echo "MIGRATE variable is set to: $MIGRATE"

if [ "$MIGRATE" = "true" ]; then
  echo "Running Alembic migrations..."
  alembic upgrade head || {
    echo "ERROR: Alembic migration failed"
    exit 1
  }

  echo "Loading vocabulary data..."
  python load_vocabulary.py || {
    echo "ERROR: Vocabulary loading failed"
    exit 1
  }
fi

if [ -n "$UVICORN_WORKERS" ]; then
  WORKERS=$UVICORN_WORKERS
else
  WORKERS=1
fi
echo "Starting uvicorn with $WORKERS workers..."

exec uvicorn main:app --host 0.0.0.0 --port 9000 --workers $WORKERS --log-level info
