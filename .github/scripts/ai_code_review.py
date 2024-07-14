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
        # Get the comparison between base and head
        comparison = pull_request.base.repo.compare(
            pull_request.base.sha, pull_request.head.sha
        )
        
        # Construct the diff
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

def review_code(client: OpenAI, repo_content: str, pr_diff: str, pr_title: str, pr_body: Optional[str]) -> str:
    """Perform AI code review using OpenAI API, and decide on merge readiness."""
    sanitized_title = sanitize_input(pr_title)
    sanitized_body = sanitize_input(pr_body)
    
    prompt = f"""
    Please review the following code changes in the context of the entire codebase and provide:

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

    Entire Codebase:
    {repo_content}

    Pull Request Diff:
    {pr_diff}

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
        repo = pull_request.base.repo
        repo_content = get_repo_content(repo, pull_request.base.ref)
        pr_diff = get_pr_diff(pull_request)
        review = review_code(openai_client, repo_content, pr_diff, pull_request.title, pull_request.body)
        post_review(pull_request, review)
    except ValueError as e:
        logger.error(f"Configuration error: {str(e)}")
    except github.GithubException as e:
        logger.error(f"GitHub API error: {str(e)}")
    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")

if __name__ == "__main__":
    main()