#!/usr/bin/env python3
"""
Vocabulary data loader for Alembic-migrated database.
Loads vocabulary JSON files into vocabulary_items table.
"""

import json
import logging
import os
from pathlib import Path
import sys

import psycopg2
from psycopg2.extras import execute_values

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

db_config = {
    "host": os.getenv("DB_HOST", "localhost"),
    "port": int(os.getenv("DB_PORT", "5432")),
    "database": os.getenv("POSTGRES_DB", "linguaquiz_db"),
    "user": os.getenv("POSTGRES_USER", "linguaquiz_user"),
    "password": os.getenv("POSTGRES_PASSWORD", "password"),
}


def get_active_version_id(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT get_active_version_id()")
        result = cur.fetchone()
        if not result or result[0] is None:
            logger.error("No active content version found. Creating default version...")
            cur.execute(
                """INSERT INTO content_versions (version_name, is_active)
                   VALUES ('v1.0.0', TRUE)
                   ON CONFLICT DO NOTHING
                   RETURNING id"""
            )
            conn.commit()
            cur.execute("SELECT get_active_version_id()")
            result = cur.fetchone()

        return result[0] if result else None


def load_json_file(json_file, version_id, conn):
    with open(json_file) as f:
        data = json.load(f)

    source_language = data.get("source_language")
    target_language = data.get("target_language")
    word_list_name = data.get("word_list_name")
    translations = data.get("translations", [])

    if not translations:
        logger.warning(f"No translations found in {json_file.name}")
        return 0, 0

    records = [
        (
            version_id,
            item.get("source_word"),
            source_language,
            item.get("target_word"),
            target_language,
            word_list_name,
            None,
            item.get("source_example"),
            item.get("target_example"),
        )
        for item in translations
    ]

    with conn.cursor() as cur:
        execute_values(
            cur,
            """INSERT INTO vocabulary_items
               (version_id, source_text, source_language, target_text, target_language,
                list_name, difficulty_level, source_usage_example, target_usage_example)
               VALUES %s
               ON CONFLICT (version_id, source_text, source_language, target_language) DO NOTHING""",
            records,
        )

        inserted = cur.rowcount
        skipped = len(records) - inserted
        conn.commit()
        return inserted, skipped


def load_vocabulary():
    try:
        conn = psycopg2.connect(**db_config)
        logger.info("Connected to database successfully")

        version_id = get_active_version_id(conn)
        if not version_id:
            logger.error("Failed to get or create active version")
            sys.exit(1)

        logger.info(f"Using active version ID: {version_id}")

        vocab_dir = Path("./migrations/data/vocabulary")
        if not vocab_dir.exists():
            logger.warning(f"Vocabulary directory not found: {vocab_dir}")
            logger.info("Skipping vocabulary loading (no data to load)")
            return

        json_files = sorted(vocab_dir.glob("*.json"))
        if not json_files:
            logger.warning("No JSON files found in vocabulary directory")
            return

        total_inserted = 0
        total_skipped = 0

        for json_file in json_files:
            try:
                inserted, skipped = load_json_file(json_file, version_id, conn)
                total_inserted += inserted
                total_skipped += skipped
                logger.info(f"✓ {json_file.name}: {inserted} inserted, {skipped} skipped")
            except Exception as e:
                logger.error(f"Error loading {json_file.name}: {e}")
                conn.rollback()
                continue

        logger.info(f"\n✓ Total: {total_inserted} inserted, {total_skipped} skipped")

    except psycopg2.Error as e:
        logger.error(f"Database error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        sys.exit(1)
    finally:
        if "conn" in locals():
            conn.close()
            logger.info("Database connection closed")


if __name__ == "__main__":
    load_vocabulary()
