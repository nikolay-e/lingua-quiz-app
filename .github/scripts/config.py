#
# LinguaQuiz – Copyright © 2025 Nikolay Eremeev
#
# Dual-licensed:
#  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
#  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
#
# Contact: lingua-quiz@nikolay-eremeev.com
# Repository: https://github.com/nikolay-e/lingua-quiz
#


# config.py

# Configuration
SUPPORTED_FILE_TYPES = ('.py', '.js', '.ts', '.html', '.css', '.yml', '.yaml', '.json', '.md', '.txt')
EXCLUDE_FOLDERS = {'.git', '.github', 'node_modules', 'venv', '__pycache__'}
EXCLUDE_FILES = {'package-lock.json', 'yarn.lock'}

OPENAI_MODEL = "gpt-4o"
TOKEN_RESET_PERIOD = 60  # seconds
MAX_CHUNK_SIZE = 30000  # Max tokens per request
