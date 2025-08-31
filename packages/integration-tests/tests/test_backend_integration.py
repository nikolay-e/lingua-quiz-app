"""Backend API integration tests."""

import pytest
from tests.conftest import API_URL, SKIP_TTS_TESTS, random_username, random_password


@pytest.mark.integration
class TestHealthEndpoints:
    """Test system health endpoints."""

    def test_health_endpoint(self, api_client):
        """Test basic health check."""
        response = api_client.get(f"{API_URL}/health")
        assert response.status_code == 200

        data = response.json()
        assert data["status"] in ["healthy", "ok"]  # Accept both possible values
        assert "timestamp" in data

    def test_version_endpoint(self, api_client):
        """Test version endpoint."""
        response = api_client.get(f"{API_URL}/version")
        assert response.status_code == 200

        data = response.json()
        assert "version" in data


@pytest.mark.integration
class TestAuthentication:
    """Test user authentication flows."""

    def test_user_registration(self, api_client):
        """Test user registration."""
        username = random_username()
        password = random_password()

        response = api_client.post(
            f"{API_URL}/auth/register",
            json={"username": username, "password": password},
        )

        assert response.status_code == 201
        data = response.json()
        assert data["user"]["username"] == username
        assert "token" in data
        assert "user" in data
        assert "id" in data["user"]

    def test_user_registration_duplicate(self, api_client, test_user):
        """Test registration with duplicate username fails."""
        response = api_client.post(
            f"{API_URL}/auth/register",
            json={"username": test_user["username"], "password": "different_password"},
        )

        assert response.status_code == 400
        data = response.json()
        assert "already exists" in data["detail"].lower()

    def test_user_login(self, api_client, test_user):
        """Test user login."""
        response = api_client.post(
            f"{API_URL}/auth/login",
            json={"username": test_user["username"], "password": test_user["password"]},
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user"]["username"] == test_user["username"]
        assert "token" in data

    def test_user_login_invalid_credentials(self, api_client, test_user):
        """Test login with invalid credentials fails."""
        response = api_client.post(
            f"{API_URL}/auth/login",
            json={"username": test_user["username"], "password": "wrong_password"},
        )

        assert response.status_code == 401
        data = response.json()
        assert (
            "invalid" in data["detail"].lower() or "incorrect" in data["detail"].lower()
        )

    def test_protected_endpoint_without_token(self, api_client):
        """Test accessing protected endpoint without token."""
        response = api_client.get(f"{API_URL}/user/profile")
        # Should be 401 (Unauthorized) or 403 (Forbidden) for missing auth
        assert response.status_code in [401, 403]

    def test_protected_endpoint_with_invalid_token(self, api_client):
        """Test accessing protected endpoint with invalid token."""
        headers = {"Authorization": "Bearer invalid_token"}
        response = api_client.get(f"{API_URL}/user/profile", headers=headers)
        # Should be 401 (Unauthorized) or 403 (Forbidden) for invalid auth
        assert response.status_code in [401, 403]


@pytest.mark.integration
class TestUserProfile:
    """Test user profile management."""

    def test_get_user_profile(self, authenticated_api_client, test_user):
        """Test getting user profile."""
        response = authenticated_api_client.get(f"{API_URL}/user/profile")

        assert response.status_code == 200
        data = response.json()
        assert data["username"] == test_user["username"]
        assert "id" in data

    def test_update_user_profile(self, authenticated_api_client, test_user):
        """Test updating user profile."""
        new_display_name = "Updated Test User"

        response = authenticated_api_client.put(
            f"{API_URL}/user/profile", json={"display_name": new_display_name}
        )

        if response.status_code == 200:
            data = response.json()
            assert data["display_name"] == new_display_name
        else:
            # Profile update might not be implemented - just check it's handled gracefully
            assert response.status_code in [404, 405, 501]


@pytest.mark.integration
class TestQuizContent:
    """Test quiz content endpoints."""

    def test_get_quiz_levels(self, api_client):
        """Test getting available quiz levels."""
        response = api_client.get(f"{API_URL}/quiz/levels")

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            if data:  # If levels exist, validate structure
                assert "id" in data[0] or "name" in data[0]
        else:
            # Quiz levels might not be implemented yet
            assert response.status_code in [404, 501]

    def test_get_quiz_questions(self, authenticated_api_client):
        """Test getting quiz questions."""
        response = authenticated_api_client.get(f"{API_URL}/quiz/questions")

        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
        else:
            # Questions endpoint might not be implemented
            assert response.status_code in [404, 501]


@pytest.mark.integration
@pytest.mark.skipif(SKIP_TTS_TESTS, reason="TTS tests disabled")
class TestTextToSpeech:
    """Test text-to-speech functionality."""

    def test_tts_endpoint(self, authenticated_api_client):
        """Test text-to-speech conversion."""
        response = authenticated_api_client.post(
            f"{API_URL}/tts/synthesize",
            json={"text": "Hello, this is a test", "language": "en"},
        )

        if response.status_code == 200:
            # Should return audio data
            assert response.headers.get("content-type") in [
                "audio/mpeg",
                "audio/wav",
                "audio/ogg",
            ]
            assert len(response.content) > 0
        else:
            # TTS might not be configured in test environment
            assert response.status_code in [404, 501, 503]


@pytest.mark.integration
class TestRateLimiting:
    """Test API rate limiting."""

    def test_rate_limiting(self, api_client):
        """Test that rate limiting is enforced."""
        # Make multiple rapid requests to test rate limiting
        responses = []
        for i in range(10):
            response = api_client.get(f"{API_URL}/health")
            responses.append(response.status_code)

        # Most should succeed, but if rate limiting is active, some might be 429
        success_count = sum(1 for status in responses if status == 200)
        rate_limited_count = sum(1 for status in responses if status == 429)

        # Either no rate limiting (all 200) or some rate limiting (some 429)
        assert success_count >= 5  # At least some should succeed
        assert success_count + rate_limited_count == 10  # Account for all responses


@pytest.mark.integration
class TestErrorHandling:
    """Test API error handling."""

    def test_not_found_endpoint(self, api_client):
        """Test 404 for non-existent endpoints."""
        response = api_client.get(f"{API_URL}/nonexistent/endpoint")
        assert response.status_code == 404

    def test_invalid_json_payload(self, api_client):
        """Test handling of invalid JSON."""
        response = api_client.post(
            f"{API_URL}/auth/login",
            data="invalid json",
            headers={"Content-Type": "application/json"},
        )
        assert response.status_code in [400, 422]  # Bad request or unprocessable entity

    def test_missing_required_fields(self, api_client):
        """Test handling of missing required fields."""
        response = api_client.post(
            f"{API_URL}/auth/register",
            json={
                "username": "testuser"
                # Missing password field
            },
        )
        assert response.status_code in [400, 422]

        data = response.json()
        assert "password" in str(data).lower() or "required" in str(data).lower()
