#!/usr/bin/env python3
"""
LinguaQuiz Minimal Flask Backend
Single-file implementation assuming database is already set up
"""

import os
import datetime
import functools
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.pool import SimpleConnectionPool
import bcrypt
import jwt

# Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 5432))
DB_NAME = os.getenv('POSTGRES_DB', 'linguaquiz_db')
DB_USER = os.getenv('POSTGRES_USER', 'linguaquiz_user')
DB_PASSWORD = os.getenv('POSTGRES_PASSWORD', 'password')
JWT_SECRET = os.getenv('JWT_SECRET', 'your_jwt_secret_key_here')
JWT_EXPIRES_IN = os.getenv('JWT_EXPIRES_IN', '1h')
PORT = int(os.getenv('PORT', 9000))

# Flask app
app = Flask(__name__)
CORS(app, origins=['*'])

# Rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["500 per 15 minutes"]
)

# Database pool
db_pool = SimpleConnectionPool(
    1, 10,
    host=DB_HOST,
    port=DB_PORT,
    database=DB_NAME,
    user=DB_USER,
    password=DB_PASSWORD
)

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
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            rv = cur.fetchall()
            return (rv[0] if rv else None) if one else rv
    finally:
        put_db(conn)

def execute_db(query, args=()):
    conn = get_db()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, args)
            conn.commit()
            return cur.rowcount
    finally:
        put_db(conn)

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
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    if not email or '@' not in email:
        return jsonify({'message': 'Invalid email format'}), 400
    if len(password) < 8:
        return jsonify({'message': 'Password must be at least 8 characters long'}), 400
    
    # Check if user exists
    if query_db('SELECT EXISTS(SELECT 1 FROM "user" WHERE email = %s)', [email], one=True)['exists']:
        return jsonify({'message': 'Conflict: The resource already exists or cannot be created.'}), 409
    
    # Create user
    hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = query_db(
        'INSERT INTO "user" (email, password) VALUES (%s, %s) RETURNING id, email',
        [email, hashed], one=True
    )
    execute_db('COMMIT')
    
    # Generate token
    token = jwt.encode({
        'userId': user['id'],
        'sub': user['email'],
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'expiresIn': JWT_EXPIRES_IN,
        'user': {'id': user['id'], 'email': user['email']}
    }), 201

@app.route('/api/auth/login', methods=['POST'])
@limiter.limit("100 per 15 minutes")
def login():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    
    user = query_db('SELECT id, email, password FROM "user" WHERE email = %s', [email], one=True)
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({'message': 'Authentication failed.'}), 401
    
    token = jwt.encode({
        'userId': user['id'],
        'sub': user['email'],
        'iat': datetime.datetime.utcnow(),
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=1)
    }, JWT_SECRET, algorithm='HS256')
    
    return jsonify({
        'token': token,
        'expiresIn': JWT_EXPIRES_IN,
        'user': {'id': user['id'], 'email': user['email']}
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

# Error handler
@app.errorhandler(404)
def not_found(e):
    return jsonify({'message': 'The requested resource was not found.'}), 404

@app.errorhandler(Exception)
def handle_error(e):
    print(f"Error: {e}")
    return jsonify({'message': 'An internal server error occurred.'}), 500

if __name__ == '__main__':
    print(f"Starting server on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False)