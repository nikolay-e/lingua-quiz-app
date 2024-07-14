import os
import logging
import time
from typing import List, Dict, Optional
import github
from openai import OpenAI
import html
import tiktoken

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
SUPPORTED_FILE_TYPES = ('.py', '.js', '.ts', '.html', '.css', '.yml', '.yaml', '.json', '.md', '.txt')
OPENAI_MODEL = "gpt-4-turbo"
TOKEN_RESET_PERIOD = 60  # seconds
MAX_CHUNK_SIZE = 25000  # Leave some room for system message and response

def get_env_variable(name: str) -> str:
    """Safely retrieve environment variables."""
    value = os.environ.get(name)
    if not value:
        raise ValueError(f"{name} environment variable is not set")
    return value

def init_openai_client() -> OpenAI:
    """Initialize and return the OpenAI client."""
    api_key = get_env_variable("OPENAI_API_KEY")
    return OpenAI(api_key=api_key)

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
    """Get the content of all files in the repository."""
    content = ""
    try:
        contents = repo.get_contents("", ref=branch)
        while contents:
            file_content = contents.pop(0)
            if file_content.type == "dir":
                contents.extend(repo.get_contents(file_content.path, ref=branch))
            else:
                if file_content.name.endswith(SUPPORTED_FILE_TYPES):
                    content += f"File: {file_content.path}\n```\n{file_content.decoded_content.decode('utf-8')}\n```\n\n"
    except github.GithubException as e:
        logger.error(f"GitHub API error when fetching repo content: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when fetching repo content: {str(e)}")
        raise
    return content

def get_pr_diff(pull_request: github.PullRequest.PullRequest) -> str:
    """Get the diff of the pull request."""
    try:
        comparison = pull_request.base.repo.compare(
            pull_request.base.sha, pull_request.head.sha
        )
        
        diff = ""
        for file in comparison.files:
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

def split_codebase(repo_content: str, chunk_size: int = 4000) -> List[str]:
    """Split the codebase into chunks of specified size."""
    chunks = []
    current_chunk = ""
    for line in repo_content.split('\n'):
        if len(current_chunk) + len(line) + 1 > chunk_size:
            chunks.append(current_chunk)
            current_chunk = line + '\n'
        else:
            current_chunk += line + '\n'
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

def post_review(pull_request: github.PullRequest.PullRequest, review: str) -> None:
    """Post the review as a comment on the pull request."""
    try:
        pull_request.create_issue_comment(f"AI Code Review:\n\n{review}")
    except github.GithubException as e:
        logger.error(f"GitHub API error when posting review: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error when posting review: {str(e)}")

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

def analyze_codebase(client: OpenAI, repo_content: str) -> str:
    """Analyze the entire codebase or large chunks of it."""
    chunks = split_codebase(repo_content)
    analyses = []

    for i, chunk in enumerate(chunks):
        try:           
            system_message = """You are an expert code analyzer preparing information for a pull request review. Analyze the given code and provide:
            1. A concise summary of key aspects.
            2. Main functions, classes, or components and their purposes.
            3. Important patterns, architectural decisions, or coding styles.
            4. Potential areas of interest for a code review (e.g., complex logic, security-sensitive parts).
            5. Any other observations relevant for reviewing changes in a pull request context."""

            user_message = f"""Analyze the following code and provide a structured summary:

            {chunk}

            Structure your response as follows:
            1. Overview
            2. Key Components
            3. Notable Patterns/Decisions
            4. Review Focus Areas
            5. Additional Notes"""

            response = client.chat.completions.create(
                model=OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": system_message},
                    {"role": "user", "content": user_message}
                ]
            )
            analyses.append(response.choices[0].message.content)
            logger.info(f"Completed analysis of chunk {i+1}/{len(chunks)}")
            time.sleep(TOKEN_RESET_PERIOD)
        except Exception as e:
            logger.error(f"OpenAI API error during chunk {i+1} analysis: {str(e)}")
            analyses.append(f"Error occurred during analysis of chunk {i+1}: {str(e)}")

    return "\n\n".join(analyses)

def review_code(client: OpenAI, repo_content: str, pr_diff: str, pr_title: str, pr_body: Optional[str]) -> str:
    """Perform AI code review using OpenAI API, and decide on merge readiness."""
    logger.info("Starting codebase analysis")
    codebase_analysis = analyze_codebase(client, repo_content)
    logger.info("Completed codebase analysis")
    
    sanitized_title = sanitize_input(pr_title)
    sanitized_body = sanitize_input(pr_body)
    
    final_review_prompt = f"""
    Based on the following analysis of the codebase:

    {codebase_analysis}

    Please review this pull request:

    PR Title: {sanitized_title}
    PR Body: {sanitized_body}

    Pull Request Diff:
    {pr_diff}

    Provide:
    1. Feedback on:
       a. Code style and formatting
       b. Potential bugs or errors
       c. Suggestions for improvement
       d. Any security concerns
       e. Overall design and architecture considerations
    2. A suggested better short commit message based on the changes and the provided PR title and body
    3. A decision on whether the code is ready to be merged (YES/NO) with a brief explanation

    Structure your response as follows:
    Code Review:
    [Your detailed review here]

    Suggested Short Commit Message:
    [Your suggested short commit message here]

    Merge Decision:
    [YES/NO]: [Brief explanation for the decision]
    """

    try:        
        logger.info("Sending final review request to OpenAI")
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert code reviewer. Provide a comprehensive review based on the provided codebase analysis and pull request details."},
                {"role": "user", "content": final_review_prompt}
            ]
        )
        logger.info("Received final review response from OpenAI")
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI API error during final review: {str(e)}")
        return f"Error occurred during code review: {str(e)}"

def main():
    try:
        logger.info("Starting code review process")
        openai_client = init_openai_client()
        pull_request = init_github_client()
        repo = pull_request.base.repo
        logger.info("Fetching repository content")
        repo_content = get_repo_content(repo, pull_request.base.ref)
        logger.info("Fetching pull request diff")
        pr_diff = get_pr_diff(pull_request)
        logger.info("Starting code review")
        review = review_code(openai_client, repo_content, pr_diff, pull_request.title, pull_request.body)
        logger.info("Posting review")
        post_review(pull_request, review)
        logger.info("Code review process completed successfully")
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
    except github.GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    main()
