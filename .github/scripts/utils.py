import os
import logging
import github
import html
import tiktoken
from typing import List, Optional
from config import OPENAI_MODEL, MAX_CHUNK_SIZE, EXCLUDE_FOLDERS, EXCLUDE_FILES, SUPPORTED_FILE_TYPES

logger = logging.getLogger(__name__)

OPENAI_MODEL = "gpt-4-turbo"
MAX_CHUNK_SIZE = 30000

def get_env_variable(name: str) -> str:
    """Safely retrieve environment variables."""
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} environment variable is not set")
    return value

def init_github_client() -> github.PullRequest.PullRequest:
    """Initialize GitHub client and return the current pull request."""
    github_token = get_env_variable("GITHUB_TOKEN")
    repo_name = get_env_variable("GITHUB_REPOSITORY")
    pr_number = parse_pr_number(get_env_variable("GITHUB_REF"))

    try:
        g = github.Github(github_token)
        repo = g.get_repo(repo_name)
        return repo.get_pull(pr_number)
    except github.GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when initializing GitHub client: {str(e)}")
        raise

def parse_pr_number(github_ref: str) -> int:
    """Parse PR number from GITHUB_REF safely."""
    try:
        return int(github_ref.split("/")[-2])
    except (IndexError, ValueError):
        raise ValueError(f"Invalid GITHUB_REF format: {github_ref}")

def get_repo_content(repo: github.Repository.Repository, branch: str) -> str:
    """Get the content of all files in the repository, excluding specified folders and files."""
    content = ""
    try:
        contents = repo.get_contents("", ref=branch)
        while contents:
            file_content = contents.pop(0)
            path_parts = file_content.path.split('/')

            if file_content.type == "dir":
                if path_parts[-1] not in EXCLUDE_FOLDERS:
                    contents.extend(repo.get_contents(file_content.path, ref=branch))
            else:
                if (file_content.name not in EXCLUDE_FILES and
                    not any(folder in EXCLUDE_FOLDERS for folder in path_parts[:-1]) and
                    file_content.name.endswith(SUPPORTED_FILE_TYPES)):
                    content += f"File: {file_content.path}\n```\n{file_content.decoded_content.decode('utf-8')}\n```\n\n"
    except github.GithubException as e:
        logger.error(f"GitHub API error when fetching repo content: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when fetching repo content: {str(e)}")
        raise
    return content

def get_pr_diff(pull_request: github.PullRequest.PullRequest) -> str:
    """Get the diff of the pull request, excluding specified folders and files."""
    try:
        comparison = pull_request.base.repo.compare(
            pull_request.base.sha, pull_request.head.sha
        )
        
        diff = ""
        for file in comparison.files:
            path_parts = file.filename.split('/')
            
            if (any(folder in EXCLUDE_FOLDERS for folder in path_parts) or
                path_parts[-1] in EXCLUDE_FILES):
                continue
            
            diff += f"File: {file.filename}\n"
            diff += f"Status: {file.status}\n"
            diff += f"Changes: +{file.additions} -{file.deletions}\n"
            if file.patch:
                diff += f"Patch:\n{file.patch}\n"
            diff += "\n"
        
        return diff
    except github.GithubException as e:
        logger.error(f"GitHub API error when fetching PR diff: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when fetching PR diff: {str(e)}")
        raise

def sanitize_input(text: Optional[str]) -> str:
    """Sanitize input to prevent potential injection issues."""
    if text is None:
        return ""
    return html.escape(text)

def post_review(pull_request: github.PullRequest.PullRequest, review: str) -> None:
    """Post the review as a comment on the pull request."""
    try:
        pull_request.create_issue_comment(f"AI Code Review:\n\n{review}")
    except github.GithubException as e:
        logger.error(f"GitHub API error when posting review: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error when posting review: {str(e)}")

def count_tokens(text: str) -> int:
    """Count the number of tokens in the given text."""
    encoding = tiktoken.encoding_for_model(OPENAI_MODEL)
    return len(encoding.encode(text))

def split_codebase(repo_content: str) -> List[str]:
    """Split the codebase into chunks, respecting the larger context window."""
    encoding = tiktoken.encoding_for_model(OPENAI_MODEL)
    total_tokens = len(encoding.encode(repo_content))

    if total_tokens <= MAX_CHUNK_SIZE:
        logger.info("Entire codebase fits within one chunk")
        return [repo_content]

    chunks = []
    current_chunk = ""
    current_chunk_tokens = 0

    for line in repo_content.split('\n'):
        line_tokens = len(encoding.encode(line))
        if current_chunk_tokens + line_tokens > MAX_CHUNK_SIZE and current_chunk:
            chunks.append(current_chunk)
            current_chunk = ""
            current_chunk_tokens = 0
        current_chunk += line + '\n'
        current_chunk_tokens += line_tokens

    if current_chunk:
        chunks.append(current_chunk)

    logger.info(f"Split codebase into {len(chunks)} chunks")
    return chunks
