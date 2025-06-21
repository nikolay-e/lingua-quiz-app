#!/usr/bin/env python3
"""
LinguaQuiz Minimal Flask Backend
Single-file implementation assuming database is already set up
"""

import os
import datetime
import functools
import base64
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import bcrypt
import jwt
import werkzeug.exceptions
# from quiz_logic import QuizManager  # Removed - business logic moved to frontend
from tts_service import TTSService

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('POSTGRES_DB', 'linguaquiz_db')
DB_USER = os.getenv('POSTGRES_USER', 'linguaquiz_user')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'password')
JWT_SECRET = os.getenv('JWT_SECRET')
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET environment variable must be set - never use default secrets in production!")
JWT_EXPIRES_IN = os.getenv('JWT_EXPIRES_IN', '24h')
JWT_EXPIRES_HOURS = int(os.getenv('JWT_EXPIRES_HOURS', '24'))
PORT = int(os.getenv('PORT', 9000))
CORS_ALLOWED_ORIGINS = os.getenv('CORS_ALLOWED_ORIGINS', 
    'http://localhost:8080,http://localhost:5173,https://lingua-quiz.nikolay-eremeev.com,https://test-lingua-quiz.nikolay-eremeev.com'
).split(',')
if '*' in CORS_ALLOWED_ORIGINS:
    print("WARNING: CORS is open to all origins (*) - this is insecure for production!")

# Flask app
app = Flask(__name__)
CORS(app, origins=CORS_ALLOWED_ORIGINS, methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["100000 per 15 minutes"]  # Very high limit for comprehensive testing
)

# Database pool configuration
DB_POOL_MIN_SIZE = int(os.getenv('DB_POOL_MIN_SIZE', '5'))
DB_POOL_MAX_SIZE = int(os.getenv('DB_POOL_MAX_SIZE', '10'))

# Database pool
db_pool = SimpleConnectionPool(
    DB_POOL_MIN_SIZE,
    DB_POOL_MAX_SIZE,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

# Quiz manager removed - business logic moved to frontend quiz-core.ts

# TTS service
tts_service = TTSService(db_pool)

# Helper functions
def snake_to_camel(snake_str):
    """Convert snake_case to camelCase"""
    components = snake_str.split('_')
    return components[0] + ''.join(x.title() for x in components[1:])

def convert_keys_to_camel_case(obj):
    """Convert all keys in dict/list from snake_case to camelCase"""
    if isinstance(obj, list):
        return [convert_keys_to_camel_case(item) for item in obj]
    elif isinstance(obj, dict):
        return {snake_to_camel(k): convert_keys_to_camel_case(v) for k, v in obj.items()}
    else:
        return obj

# Database helpers
def get_db():
    return db_pool.getconn()

def put_db(conn):
    db_pool.putconn(conn)

def query_db(query, args=(), one=False):
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
        print(f"Connection pool error: {e}")
        raise
    except Exception as e:
        print(f"Database query error: {e}")
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                print(f"CRITICAL: Failed to return connection to pool: {e}")
                # Force close the connection to prevent leak
                try:
                    conn.close()
                except:
                    pass

def execute_db(query, args=()):
    conn = None
    try:
        conn = get_db()
        if not conn:
            raise Exception("Failed to get database connection")
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            conn.commit()
            return cur.rowcount
    except psycopg2.pool.PoolError as e:
        print(f"Connection pool error: {e}")
        raise
    except Exception as e:
        print(f"Database execute error: {e}")
        if conn:
            try:
                conn.rollback()
            except:
                pass  # Don't raise in rollback
        raise
    finally:
        if conn:
            try:
                put_db(conn)
            except Exception as e:
                print(f"CRITICAL: Failed to return connection to pool: {e}")
                # Force close the connection to prevent leak
                try:
                    conn.close()
                except:
                    pass

# Auth decorator
def auth_required(f):
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'message': 'No token provided'}), 401
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            request.user_id = payload['userId']
        except:
            return jsonify({'message': 'Invalid or expired token'}), 401
        return f(*args, **kwargs)
    return decorated

# Routes
@app.route('/api/health')
def health():
    try:
        query_db("SELECT 1", one=True)
        return jsonify({
            'status': 'ok',
            'message': 'All systems operational',
            'timestamp': datetime.datetime.utcnow().isoformat() + 'Z',
            'components': {
                'api': {'status': 'ok', 'message': 'API server running'},
                'database': {'status': 'ok', 'message': 'Database connection successful'}
            }
        })
    except:
        return jsonify({'status': 'error', 'message': 'Database unavailable'}), 503

@app.route('/api/auth/register', methods=['POST'])
@limiter.limit("100 per 15 minutes")
def register():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    if not username or len(username) < 3:
        return jsonify({'message': 'Username must be at least 3 characters long'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters long'}), 400
    
    # Check if user exists
    if query_db('SELECT EXISTS(SELECT 1 FROM "user" WHERE username = %s)', [username], one=True)['exists']:
        return jsonify({'message': 'Conflict: The resource already exists or cannot be created.'}), 409
    
    # Create user
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    conn = get_db()
    user = None
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                'INSERT INTO "user" (username, password) VALUES (%s, %s) RETURNING id, username',
                [username, hashed]
            )
            user = cur.fetchone()
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Failed to create user: {e}")
        raise
    finally:
        put_db(conn)
    
    # Generate token
    token = jwt.encode({
        'userId': user['id'],
        'sub': user['username'],
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRES_HOURS)
    }, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'expiresIn': JWT_EXPIRES_IN,
        'user': {'id': user['id'], 'username': user['username']}
    }), 201

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("100 per 15 minutes")
def login():
    data = request.get_json()
    username = data.get('username', '').strip()
    password = data.get('password', '')
    
    user = query_db('SELECT id, username, password FROM "user" WHERE username = %s', [username], one=True)
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'message': 'Authentication failed.'}), 401
    
    token = jwt.encode({
        'userId': user['id'],
        'sub': user['username'],
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=JWT_EXPIRES_HOURS)
    }, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'expiresIn': JWT_EXPIRES_IN,
        'user': {'id': user['id'], 'username': user['username']}
    })

@app.route('/api/auth/delete-account', methods=['DELETE'])
@auth_required
def delete_account():
    execute_db('DELETE FROM "user" WHERE id = %s', [request.user_id])
    return jsonify({'message': 'Account deleted successfully'})

@app.route('/api/word-sets')
@auth_required
def get_word_lists():
    lists = query_db('SELECT * FROM get_word_lists()')
    return jsonify(convert_keys_to_camel_case(lists))

@app.route('/api/word-sets/<int:id>')
@auth_required
def get_word_set(id):
    word_set = query_db(
        'SELECT id, name, created_at::text as "createdAt", updated_at::text as "updatedAt" FROM word_list WHERE id = %s',
        [id], one=True
    )
    if not word_set:
        return jsonify({'message': 'Word set not found'}), 404
    
    words = query_db("""
        SELECT 
            t.id as "translationId",
            sw.id as "sourceWordId", tw.id as "targetWordId",
            sw.text as "sourceWord", tw.text as "targetWord",
            sl.name as "sourceLanguage", tl.name as "targetLanguage",
            sw.usage_example as "sourceExample", tw.usage_example as "targetExample"
        FROM word_list_entry wle
        JOIN translation t ON wle.translation_id = t.id
        JOIN word sw ON t.source_word_id = sw.id
        JOIN word tw ON t.target_word_id = tw.id
        JOIN language sl ON sw.language_id = sl.id
        JOIN language tl ON tw.language_id = tl.id
        WHERE wle.word_list_id = %s
        ORDER BY wle.id
    """, [id])
    
    # Note: The query already uses camelCase aliases, so no conversion needed
    word_set['words'] = words
    return jsonify(word_set)

@app.route('/api/word-sets/user')
@auth_required
def get_user_word_sets():
    word_list_name = request.args.get('wordListName')
    if not word_list_name:
        return jsonify({'message': 'wordListName query parameter is required'}), 400
    
    word_sets = query_db('SELECT * FROM get_user_word_sets(%s, %s)', [request.user_id, word_list_name])
    return jsonify(convert_keys_to_camel_case(word_sets))

@app.route('/api/word-sets/user', methods=['POST'])
@auth_required
def update_user_word_sets():
    data = request.get_json()
    status = data.get('status', '').strip()
    word_pair_ids = data.get('wordPairIds', [])
    
    valid_statuses = ['LEVEL_0', 'LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4', 'LEVEL_5']
    if status not in valid_statuses:
        return jsonify({'message': 'Invalid status value'}), 400
    
    if not word_pair_ids:
        return jsonify({'message': 'Word sets status update request received (no changes applied for empty list).'})
    
    execute_db('SELECT update_user_word_set_status(%s, %s, %s::translation_status)', 
               [request.user_id, word_pair_ids, status])
    
    return jsonify({'message': 'Word sets status updated successfully'})


# TTS Routes
@app.route('/api/tts/synthesize', methods=['POST'])
@auth_required
@limiter.limit("100 per 1 minute", key_func=lambda: request.headers.get('Authorization', ''))
def synthesize_speech():
    """Synthesize speech for given text and language"""
    if not tts_service.is_available():
        return jsonify({'message': 'TTS service unavailable'}), 503
    
    data = request.get_json()
    if not data:
        return jsonify({'message': 'JSON payload required'}), 400
        
    text = data.get('text', '').strip()
    language = data.get('language', '')
    
    if not text or len(text) > 500:
        return jsonify({'message': 'Text must be between 1 and 500 characters'}), 400
    
    if language not in tts_service.get_supported_languages():
        return jsonify({'message': f'Language {language} not supported'}), 400
    
    try:
        audio_content = tts_service.synthesize_speech(text, language)
        if audio_content is None:
            return jsonify({'message': 'Text not found in database or TTS synthesis failed'}), 400
        
        audio_b64 = base64.b64encode(audio_content).decode('utf-8')
        return jsonify({
            'audioData': audio_b64,
            'contentType': 'audio/mpeg',
            'text': text,
            'language': language
        })
    except Exception as e:
        print(f"TTS synthesis error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'TTS synthesis failed'}), 500

@app.route('/api/tts/languages', methods=['GET'])
@auth_required
def get_tts_languages():
    """Get supported TTS languages"""
    return jsonify({
        'supportedLanguages': tts_service.get_supported_languages(),
        'available': tts_service.is_available()
    })

# Test endpoint for answer comparison logic (NON-PRODUCTION)
@app.route('/api/test/answer-comparison', methods=['POST'])
def test_answer_comparison():
    """
    Test endpoint for validating answer comparison logic.
    WARNING: This endpoint should only be used for testing and development.
    """
    # Prevent production usage
    if os.getenv('ENVIRONMENT', '').lower() == 'production':
        return jsonify({'error': 'Test endpoints are not available in production'}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON data required'}), 400
    
    user_answer = data.get('userAnswer', '').strip()
    correct_answer = data.get('correctAnswer', '').strip()
    
    if not user_answer or not correct_answer:
        return jsonify({'error': 'Both userAnswer and correctAnswer are required'}), 400
    
    try:
        # Use the same pattern as other endpoints - use the utility functions
        is_correct_result = query_db("""
            SELECT util_check_answer_correctness(%s, %s) as is_correct
        """, (user_answer, correct_answer), one=True)
        
        display_result = query_db("""
            SELECT util_clean_pipe_alternatives(%s) as display_text
        """, (correct_answer,), one=True)
        
        bracket_result = query_db("""
            SELECT util_create_bracket_alternatives(%s) as bracket_alternatives
        """, (correct_answer,), one=True)
        
        group_result = query_db("""
            SELECT util_expand_parentheses_groups(%s) as group_expansions
        """, (correct_answer,), one=True)
        
        return jsonify({
            'input': {
                'userAnswer': user_answer,
                'correctAnswer': correct_answer
            },
            'result': {
                'isCorrect': is_correct_result['is_correct'],
                'displayText': display_result['display_text'],
                'bracketAlternatives': bracket_result['bracket_alternatives'],
                'groupExpansions': group_result['group_expansions']
            },
            'explanation': {
                'hasParenthesesGrouping': '(' in correct_answer and ',' in correct_answer,
                'hasPipes': '|' in correct_answer,
                'hasCommas': ',' in correct_answer,
                'hasSquareBrackets': '[' in correct_answer
            }
        })
                
    except Exception as e:
        print(f"Error in test endpoint: {e}")
        return jsonify({'error': 'An internal error has occurred.'}), 500

# Error handler
@app.errorhandler(404)
def not_found(e):
    return jsonify({'message': 'The requested resource was not found.'}), 404

@app.errorhandler(Exception)
def handle_error(e):
    # Handle specific exceptions with appropriate status codes
    if isinstance(e, werkzeug.exceptions.TooManyRequests):
        return jsonify({'message': 'Too many requests. Please try again later.'}), 429
    elif isinstance(e, werkzeug.exceptions.HTTPException):
        # Pass through HTTP exceptions with their status codes
        return jsonify({'message': e.description}), e.code
    elif isinstance(e, psycopg2.pool.PoolError):
        print(f"Database pool error: {e}")
        return jsonify({'message': 'Database connection unavailable. Please try again.'}), 503
    else:
        # Log the actual error for debugging
        print(f"Unhandled error: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'message': 'An internal server error occurred.'}), 500

if __name__ == '__main__':
    # Enable debug mode if DEBUG env var is set
    debug_mode = os.getenv('DEBUG', 'false').lower() == 'true'
    print(f"Starting server on port {PORT} (debug={debug_mode})")
    app.run(host='0.0.0.0', port=PORT, debug=debug_mode)