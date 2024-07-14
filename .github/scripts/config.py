# config.py

# Configuration
SUPPORTED_FILE_TYPES = ('.py', '.js', '.ts', '.html', '.css', '.yml', '.yaml', '.json', '.md', '.txt')
EXCLUDE_FOLDERS = {'.git', '.github', 'data', 'node_modules', 'venv'}
EXCLUDE_FILES = {'package-lock.json'}

OPENAI_MODEL = "gpt-4-turbo"
TOKEN_RESET_PERIOD = 60  # seconds
MAX_CHUNK_SIZE = 30000  # Increased to 30,000 tokens