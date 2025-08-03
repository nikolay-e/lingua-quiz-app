#!/bin/sh
# Wait for database to be ready
echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
while ! nc -z "${DB_HOST}" "${DB_PORT}"; do
  echo "Database not ready, waiting..."
  sleep 2
done
echo "Database is ready!"
sleep 2

if [ "$MIGRATE" = "true" ]; then
  echo "Running migrations..."
  python migrate.py
fi

# Calculate workers with a lower cap for database connections
# FastAPI with uvicorn handles async requests efficiently
WORKERS=$(python -c "import multiprocessing; print(min(multiprocessing.cpu_count() + 1, 4))")
echo "Starting uvicorn with $WORKERS workers..."

exec uvicorn main:app --host 0.0.0.0 --port 9000 --workers "$WORKERS" --log-level info
