import logging

from core.config import (
    DB_HOST,
    DB_NAME,
    DB_PASSWORD,
    DB_POOL_MAX_SIZE,
    DB_POOL_MIN_SIZE,
    DB_PORT,
    DB_USER,
)
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool

logger = logging.getLogger(__name__)

db_pool = SimpleConnectionPool(
    DB_POOL_MIN_SIZE,
    DB_POOL_MAX_SIZE,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD,
)


def get_db():
    return db_pool.getconn()


def put_db(conn):
    db_pool.putconn(conn)


def query_db(query, args=(), one=False):
    query_upper = query.strip().upper()
    write_keywords = ["INSERT", "UPDATE", "DELETE", "CREATE", "DROP", "ALTER", "TRUNCATE"]

    for keyword in write_keywords:
        if query_upper.startswith(keyword):
            raise ValueError(f"query_db() detected a write operation starting with '{keyword}'. Use execute_write_transaction() instead.")

    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            rv = cur.fetchall()
            return (rv[0] if rv else None) if one else rv

    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    except Exception as e:
        logger.error(f"Database query error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                logger.critical(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except Exception:
                    pass


def execute_write_transaction(query, args=(), fetch_results=False, one=False):
    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")

        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)

            if fetch_results:
                rv = cur.fetchall()
                conn.commit()
                return (rv[0] if rv else None) if one else rv

            row_count = cur.rowcount
            conn.commit()
            return row_count

    except psycopg2.pool.PoolError as e:
        logger.error(f"Connection pool error: {e}")
        raise
    except Exception as e:
        logger.error(f"Database execute error: {e}")
        if conn:
            try:
                conn.rollback()
            except Exception:
                pass
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                logger.critical(f"Failed to return connection to pool: {e}")
                try:
                    conn.close()
                except Exception:
                    pass
