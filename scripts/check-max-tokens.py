#!/usr/bin/env python3

import os
import sys
import re
import logging
from pathlib import Path
import argparse
import tiktoken

# --- Configuration ---
# Adjust this limit based on your LLM's context window or desired chunk size
DEFAULT_MAX_TOKENS = 4000
# Model name determines the tokenizer used. Use the one relevant to your LLM.
# Common options: "gpt-4", "gpt-3.5-turbo", "gpt-4o"
DEFAULT_MODEL_NAME = "gpt-4o"

# Directories to check relative to the repository root
CHECK_DIRS = ["packages", ".github/scripts", "scripts"]

# File extensions to check
INCLUDE_EXTENSIONS = {
    '.js', '.mjs', '.cjs', '.py', '.sh', '.css', '.html',
    '.yaml', '.yml', '.json', '.sql', '.ts', '.tsx',
    '.Dockerfile', '.tpl', '.md', '.txt' # Add/remove as needed
}

# Regex patterns for paths/files/directories to ignore (relative to repo root)
# Uses forward slashes for cross-platform compatibility in patterns
IGNORE_PATTERNS = [
    r'node_modules/',
    r'dist/',
    r'build/',
    r'coverage/',
    r'test-results/',
    r'playwright-report/',
    r'pgdata_local/',
    r'\.git/',
    r'\.venv/',
    r'__pycache__/',
    r'packages/backend/helm/.*/templates/', # Ignore Helm template dir contents
    r'Generated -- .*\.sql', # Ignore generated SQL files
    r'\.pyc$',
    r'\.log$',
    r'package-lock\.json$',
    r'yarn\.lock$',
    # Add specific files if needed:
    # r'scripts/check-max-tokens\.py', # Example: ignore self
]
# --- End Configuration ---

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')
logger = logging.getLogger(__name__)

def count_tokens(text: str, encoding: tiktoken.Encoding) -> int:
    """Counts tokens in a string using the provided tiktoken encoding."""
    try:
        tokens = encoding.encode(text)
        return len(tokens)
    except Exception as e:
        logger.error(f"Error encoding text for token count: {e}")
        return 0 # Or raise? For now, return 0 and log error.

def should_ignore(file_path: Path, repo_root: Path, ignore_regexes: list) -> bool:
    """Checks if a file path should be ignored based on the patterns."""
    try:
        # Get path relative to repo root, using forward slashes for regex matching
        relative_path_str = file_path.relative_to(repo_root).as_posix()
        for pattern in ignore_regexes:
            if pattern.search(relative_path_str):
                # logger.debug(f"Ignoring '{relative_path_str}' due to pattern '{pattern.pattern}'")
                return True
    except ValueError:
         # Handle cases where file might be outside the intended repo_root structure
         logger.warning(f"Could not determine relative path for {file_path}")
         return True # Ignore if relative path calculation fails
    return False

def main():
    parser = argparse.ArgumentParser(description="Check files for maximum token count.")
    parser.add_argument(
        "--max-tokens", type=int, default=DEFAULT_MAX_TOKENS,
        help=f"Maximum allowed tokens per file (default: {DEFAULT_MAX_TOKENS})"
    )
    parser.add_argument(
        "--model", type=str, default=DEFAULT_MODEL_NAME,
        help=f"The OpenAI model name to use for tokenization (default: {DEFAULT_MODEL_NAME})"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true",
        help="Enable verbose logging"
    )
    args = parser.parse_args()

    if args.verbose:
        logger.setLevel(logging.DEBUG)

    max_tokens = args.max_tokens
    model_name = args.model
    exit_code = 0
    files_checked = 0
    files_over_limit = 0

    try:
        encoding = tiktoken.encoding_for_model(model_name)
        logger.info(f"Using tokenizer for model: {model_name}")
    except Exception as e:
        logger.error(f"Failed to get tiktoken encoding for model '{model_name}': {e}")
        sys.exit(1)

    # Determine repository root (assuming script is in repo/scripts)
    script_path = Path(__file__).resolve()
    repo_root = script_path.parent.parent # Adjust if script location changes

    logger.info(f"Repository root detected as: {repo_root}")
    logger.info(f"Checking files for token count exceeding {max_tokens}...")

    # Compile ignore patterns for efficiency
    compiled_ignore_patterns = [re.compile(p) for p in IGNORE_PATTERNS]

    check_paths = [repo_root / d for d in CHECK_DIRS]

    for check_path in check_paths:
        if not check_path.is_dir():
            logger.warning(f"Directory '{check_path}' not found. Skipping.")
            continue

        for file_path in check_path.rglob('*'): # Recursively find all items
            if file_path.is_file() and file_path.suffix.lower() in INCLUDE_EXTENSIONS:
                if should_ignore(file_path, repo_root, compiled_ignore_patterns):
                    continue

                logger.debug(f"Checking: {file_path.relative_to(repo_root)}")
                files_checked += 1
                try:
                    with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                        content = f.read()

                    token_count = count_tokens(content, encoding)

                    if token_count > max_tokens:
                        relative_path_str = file_path.relative_to(repo_root).as_posix()
                        logger.error(
                            f"File '{relative_path_str}' has {token_count} tokens (limit is {max_tokens})"
                        )
                        exit_code = 1
                        files_over_limit += 1

                except Exception as e:
                    logger.error(f"Error processing file {file_path}: {e}")
                    # Decide if a processing error should fail the check
                    # exit_code = 1

    logger.info(f"Checked {files_checked} files.")
    if exit_code != 0:
        logger.error(f"{files_over_limit} file(s) exceed the maximum token count of {max_tokens}.")
        sys.exit(exit_code)
    else:
        logger.info(f"OK: All {files_checked} checked files are within the token limit.")
        sys.exit(0)

if __name__ == "__main__":
    main()
