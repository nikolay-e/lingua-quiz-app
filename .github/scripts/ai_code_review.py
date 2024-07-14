import os
import logging
import time
from typing import List, Dict, Optional
import github
from openai import OpenAI
import html
import tiktoken
from utils import (
    get_env_variable, init_github_client, get_repo_content, get_pr_diff,
    sanitize_input, post_review, count_tokens, split_codebase
)
from config import OPENAI_MODEL, TOKEN_RESET_PERIOD, MAX_CHUNK_SIZE

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def init_openai_client() -> OpenAI:
    """Initialize and return the OpenAI client."""
    api_key = get_env_variable("OPENAI_API_KEY")
    return OpenAI(api_key=api_key)

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
    total_tokens = count_tokens(repo_content) + count_tokens(pr_diff)
    
    if total_tokens <= MAX_CHUNK_SIZE:
        logger.info("Entire codebase and PR diff fit within token limit. Proceeding with direct review.")
        content_to_review = f"Codebase:\n{repo_content}\n\nPR Diff:\n{pr_diff}"
    else:
        logger.info("Codebase and PR diff exceed token limit. Performing separate analysis.")
        logger.info("Starting codebase analysis")
        codebase_analysis = analyze_codebase(client, repo_content)
        logger.info("Completed codebase analysis")
        content_to_review = f"Codebase Analysis:\n{codebase_analysis}\n\nPR Diff:\n{pr_diff}"
    
    sanitized_title = sanitize_input(pr_title)
    sanitized_body = sanitize_input(pr_body)
    
    final_review_prompt = f"""
    Based on the following information:

    {content_to_review}

    Please review this pull request:

    PR Title: {sanitized_title}
    PR Body: {sanitized_body}

    Provide:
    1. Feedback on:
       a. Code style and formatting status OK or NOT OK, add short review if NOT OK
       b. Potential bugs or errors
       c. Suggestions for improvement
       d. Any security concerns
       e. Overall design and architecture considerations - dont mention documentation
    2. A suggested better short commit message based on the changes and the provided PR title and body
    3. A decision on whether the code is ready to be merged (YES/NO) with a brief explanation. Be consise. Always add file name. Be specific!!!

    Structure your response as follows:
    Code Review:
    [Your review here]

    Suggested Short Commit Message:
    [Your suggested short commit message here]

    Merge Decision:
    [YES/NO]: [Brief explanation for the decision. Be consise. Always add file name. Be specific!!!]
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