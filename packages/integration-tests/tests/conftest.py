"""Pytest configuration and fixtures for integration tests."""

import os
import random
import string

import pytest
import requests

# Configuration from environment
API_URL = os.getenv("API_URL", "http://localhost:9000/api")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:80")
TIMEOUT = int(os.getenv("TIMEOUT", "30"))
SKIP_TTS_TESTS = os.getenv("SKIP_TTS_TESTS", "false").lower() == "true"


def random_username() -> str:
    """Generate random test username."""
    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    return f"test_{suffix}"


def random_password() -> str:
    """Generate random test password."""
    return "".join(random.choices(string.ascii_letters + string.digits + "!@#$%^&*", k=12))


@pytest.fixture(scope="session")
def api_client():
    """HTTP session for API calls."""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    yield session
    session.close()


@pytest.fixture(scope="session")
def test_user(api_client):
    """Create a test user for the session."""
    username = random_username()
    password = random_password()

    # Register test user
    response = api_client.post(f"{API_URL}/auth/register", json={"username": username, "password": password})

    if response.status_code != 201:
        pytest.skip(f"Failed to create test user: {response.text}")

    user_data = response.json()

    yield {
        "username": username,
        "password": password,
        "id": user_data.get("user", {}).get("id"),
        "token": user_data.get("token"),
    }


@pytest.fixture(scope="session")
def web_session():
    """HTTP session for e2e tests."""
    session = requests.Session()
    yield session
    session.close()


@pytest.fixture
def authenticated_api_client(api_client, test_user):
    """API client with authentication headers."""
    api_client.headers.update({"Authorization": f"Bearer {test_user['token']}"})
    yield api_client
    # Clean up - remove auth header
    if "Authorization" in api_client.headers:
        del api_client.headers["Authorization"]
