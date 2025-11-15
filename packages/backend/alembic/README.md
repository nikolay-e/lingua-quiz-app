# Alembic Database Migrations

This directory contains Alembic database migrations for the LinguaQuiz backend.

## Setup

Install dependencies:

```bash
pip install -r requirements.txt
```

Set environment variables:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export POSTGRES_DB=linguaquiz_db
export POSTGRES_USER=linguaquiz_user
export POSTGRES_PASSWORD=password
```

## Usage

### Run migrations

```bash
# Upgrade to latest version
alembic upgrade head

# Upgrade one version
alembic upgrade +1

# Downgrade one version
alembic downgrade -1
```

### Create new migration

```bash
# Create empty migration
alembic revision -m "description"

# Auto-generate migration (requires SQLAlchemy models)
alembic revision --autogenerate -m "description"
```

### View migration history

```bash
# Show current version
alembic current

# Show migration history
alembic history

# Show SQL without executing
alembic upgrade head --sql
```

## Migration Files

- `bee616b9c42f_initial_schema.py` - Initial database schema with UUID-based vocabulary_items

## Notes

- Migrations use PostgreSQL-specific features (UUID, JSONB, pg_trgm, GIN indexes)
- Initial migration creates admin user with password `admin123` (change in production!)
- Database connection configured via environment variables in `alembic/env.py`
