import os
import logging
from typing import List, Dict
import github
from openai import OpenAI

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
SUPPORTED_FILE_TYPES = ('.py', '.js', '.ts', '.html', '.css')
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

    g = github.Github(github_token)
    repo = g.get_repo(repo_name)
    return repo.get_pull(pr_number)

def parse_pr_number(github_ref: str) -> int:
    """Parse PR number from GITHUB_REF safely."""
    try:
        return int(github_ref.split("/")[-2])
    except (IndexError, ValueError):
        raise ValueError(f"Invalid GITHUB_REF format: {github_ref}")

def get_files_content(pull_request: github.PullRequest.PullRequest) -> str:
    """Extract content from files in the pull request."""
    files_content = ""
    for file in pull_request.get_files():
        if file.filename.endswith(SUPPORTED_FILE_TYPES):
            if file.status != "removed" and file.patch:
                files_content += f"File: {file.filename}\n```\n{file.patch}\n```\n\n"
    return files_content

def review_code(client: OpenAI, files_content: str) -> str:
    """Perform AI code review using OpenAI API."""
    prompt = f"""
    Please review the following code changes and provide feedback on:
    1. Code style and formatting
    2. Potential bugs or errors
    3. Suggestions for improvement
    4. Any security concerns
    5. Overall design and architecture considerations

    Code changes:
    {files_content}

    Review:
    """

    try:
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are an expert code reviewer. Provide concise, actionable feedback."},
                {"role": "user", "content": prompt}
            ]
        )
        return response.choices[0].message.content
    except OpenAI.APIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        return "Error occurred during code review due to API issues."
    except Exception as e:
        logger.error(f"Unexpected error during OpenAI API call: {str(e)}")
        return "Unexpected error occurred during code review."

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
        review = review_code(openai_client, files_content)
        post_review(pull_request, review)
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    main()