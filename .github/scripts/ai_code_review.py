import os
import logging
from typing import List, Dict, Optional
import github
from openai import OpenAI
import html

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
SUPPORTED_FILE_TYPES = ('.py', '.js', '.ts', '.html', '.css', '.yml', '.yaml', '.json', '.md', '.txt')
MAX_LINE_LENGTH = 100
OPENAI_MODEL = "gpt-4-turbo"

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

def get_files_content(pull_request: github.PullRequest.PullRequest) -> str:
    """Extract content from files in the pull request."""
    files_content = ""
    try:
        for file in pull_request.get_files():
            if file.filename.endswith(SUPPORTED_FILE_TYPES):
                if file.status != "removed" and file.patch:
                    files_content += f"File: {file.filename}\n```\n{file.patch}\n```\n\n"
        return files_content
    except github.GithubException as e:
        logger.error(f"GitHub API error when fetching files: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error when fetching files: {str(e)}")
        raise

def sanitize_input(text: Optional[str]) -> str:
    """Sanitize input to prevent potential injection issues."""
    if text is None:
        return ""
    return html.escape(text)

def review_code(client: OpenAI, files_content: str, pr_title: str, pr_body: Optional[str]) -> str:
    """Perform AI code review using OpenAI API, and decide on merge readiness."""
    sanitized_title = sanitize_input(pr_title)
    sanitized_body = sanitize_input(pr_body)
    
    prompt = f"""
    Please review the following code changes and provide:

    1. Feedback on:
       a. Code style and formatting
       b. Potential bugs or errors
       c. Suggestions for improvement
       d. Any security concerns
       e. Overall design and architecture considerations
    2. A suggested better short commit message based on the changes and the provided PR title and body
    3. A decision on whether the code is ready to be merged (YES/NO) with a brief explanation

    PR Title: {sanitized_title}
    PR Body: {sanitized_body}

    Code changes:
    {files_content}

    Please structure your response as follows:
    Code Review:
    [Your detailed review here]

    Suggested Short Commit Message:
    [Your suggested short commit message here]

    Merge Decision:
    [YES/NO]: [Brief explanation for the decision]

    Review:
    """

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert code reviewer. Provide concise, actionable feedback, suggest a better short commit message, and make a merge decision."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except Exception as e:
        logger.error(f"OpenAI API error: {str(e)}")
        return f"Error occurred during code review: {str(e)}"

def post_review(pull_request: github.PullRequest.PullRequest, review: str) -> None:
    """Post the review as a comment on the pull request."""
    try:
        pull_request.create_issue_comment(f"AI Code Review:\n\n{review}")
    except github.GithubException as e:
        logger.error(f"GitHub API error when posting review: {str(e)}")
    except Exception as e:
        logger.error(f"Unexpected error when posting review: {str(e)}")

def main():
    try:
        openai_client = init_openai_client()
        pull_request = init_github_client()
        files_content = get_files_content(pull_request)
        review = review_code(openai_client, files_content, pull_request.title, pull_request.body)
        post_review(pull_request, review)
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
    except github.GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    main()