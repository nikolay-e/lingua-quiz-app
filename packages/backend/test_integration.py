#!/usr/bin/env python3

import os
import random
import string
import sys

import requests

API_URL = os.getenv("API_URL", "http://localhost:9000/api")
TIMEOUT = 30
SKIP_TTS_TESTS = os.getenv("SKIP_TTS_TESTS", "false").lower() == "true"

GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
RESET = "\033[0m"


class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.test_user = None
        self.token = None

    def random_username(self):
        suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"test_{suffix}"

    def test(self, name, func):
        try:
            func()
            print(f"{GREEN}✓{RESET} {name}")
            self.passed += 1
        except Exception as e:
            print(f"{RED}✗{RESET} {name}")
            print(f"  {RED}Error: {e}{RESET}")
            self.failed += 1

    def assert_equal(self, actual, expected, msg=""):
        if actual != expected:
            raise AssertionError(f"{msg}: expected {expected}, got {actual}")

    def assert_in(self, item, container, msg=""):
        if item not in container:
            raise AssertionError(f"{msg}: {item} not in {container}")

    def assert_true(self, condition, msg=""):
        if not condition:
            raise AssertionError(msg or "Condition is false")

    def run_all(self):
        print(f"\n{YELLOW}Running Integration Tests{RESET}")
        print(f"API URL: {API_URL}\n")

        self.test("Health check", self.test_health)

        self.test("Register new user", self.test_register)
        self.test("Login with correct credentials", self.test_login)
        self.test("Reject duplicate registration", self.test_duplicate_register)
        self.test("Reject invalid credentials", self.test_invalid_login)

        self.test("Reject weak password", self.test_weak_password)
        self.test("Reject short username", self.test_short_username)
        self.test("Reject empty credentials", self.test_empty_credentials)
        self.test("Reject malformed JWT token", self.test_malformed_token)

        self.test("Get word lists (authenticated)", self.test_get_word_lists)
        self.test("Get word pairs from list", self.test_get_word_pairs)
        self.test("Get user progress", self.test_get_user_progress)
        self.test("Update user progress", self.test_update_user_progress)
        self.test("Access denied without token", self.test_unauthorized)

        if not SKIP_TTS_TESTS:
            self.test("Get TTS supported languages", self.test_tts_languages)
            self.test("TTS synthesis", self.test_tts_synthesize)
            self.test(
                "TTS synthesis with unsupported language",
                self.test_tts_synthesize_unsupported_language,
            )
            self.test("TTS synthesis with empty text", self.test_tts_synthesize_empty_text)
            self.test(
                "TTS synthesis with too long text",
                self.test_tts_synthesize_too_long_text,
            )
            self.test(
                "TTS synthesis without authentication",
                self.test_tts_synthesize_unauthorized,
            )
        else:
            print(f"{YELLOW}Skipping TTS tests (SKIP_TTS_TESTS=true){RESET}")

        self.test("Delete test account", self.test_delete_account)

        print(f"\n{YELLOW}Test Summary:{RESET}")
        print(f"  {GREEN}Passed: {self.passed}{RESET}")
        if self.failed > 0:
            print(f"  {RED}Failed: {self.failed}{RESET}")
        print()

        return self.failed == 0

    def test_health(self):
        r = requests.get(f"{API_URL}/health", timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_equal(data["status"], "ok")
        self.assert_equal(data["database"], "connected")
        self.assert_in("timestamp", data)

    def test_register(self):
        self.test_user = {
            "username": self.random_username(),
            "password": "TestPassword123!",
        }
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 201)
        data = r.json()
        self.assert_in("token", data)
        self.assert_in("user", data)
        self.assert_equal(data["user"]["username"], self.test_user["username"])
        self.token = data["token"]

    def test_login(self):
        r = requests.post(f"{API_URL}/auth/login", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_in("token", data)
        self.assert_in("user", data)
        self.assert_equal(data["user"]["username"], self.test_user["username"])

    def test_duplicate_register(self):
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 400)

    def test_invalid_login(self):
        invalid_user = {
            "username": self.test_user["username"],
            "password": "WrongPassword123!",
        }
        r = requests.post(f"{API_URL}/auth/login", json=invalid_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)

    def test_weak_password(self):
        weak_user = {"username": self.random_username(), "password": "weak"}
        r = requests.post(f"{API_URL}/auth/register", json=weak_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_short_username(self):
        short_user = {"username": "ab", "password": "TestPassword123!"}
        r = requests.post(f"{API_URL}/auth/register", json=short_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_empty_credentials(self):
        r = requests.post(f"{API_URL}/auth/register", json={}, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_malformed_token(self):
        headers = {"Authorization": "Bearer invalid_token"}
        r = requests.get(f"{API_URL}/user/profile", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)

    def test_get_word_lists(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        r = requests.get(f"{API_URL}/word-lists", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_true(isinstance(data, list))

    def test_get_word_pairs(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        r = requests.get(f"{API_URL}/word-lists", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200 and r.json():
            list_name = r.json()[0]["listName"]
            r = requests.get(f"{API_URL}/word-pairs?list_name={list_name}", headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_true(isinstance(data, list))
            if data:
                first_word = data[0]
                self.assert_in("sourceText", first_word)
                self.assert_in("targetText", first_word)
                self.assert_in("sourceLang", first_word)
                self.assert_in("targetLang", first_word)

    def test_get_user_progress(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        r = requests.get(f"{API_URL}/user/progress", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_true(isinstance(data, list))

    def test_update_user_progress(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        progress_data = {
            "sourceText": "hello",
            "sourceLang": "en",
            "level": 1,
            "correctCount": 5,
            "errorCount": 2,
        }
        r = requests.post(f"{API_URL}/user/progress", json=progress_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)

    def test_unauthorized(self):
        r = requests.get(f"{API_URL}/word-lists", timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)

    def test_delete_account(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        r = requests.delete(f"{API_URL}/auth/delete-account", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        r = requests.post(f"{API_URL}/auth/login", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)

    def test_tts_languages(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        r = requests.get(f"{API_URL}/tts/languages", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_in("available", data)
        self.assert_in("supportedLanguages", data)
        self.assert_true(isinstance(data["supportedLanguages"], list))

    def test_tts_synthesize(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        tts_data = {"text": "hello", "language": "en"}
        r = requests.post(f"{API_URL}/tts/synthesize", json=tts_data, headers=headers, timeout=TIMEOUT)
        if r.status_code == 200:
            data = r.json()
            self.assert_in("audioData", data)
            self.assert_in("text", data)
            self.assert_in("language", data)

    def test_tts_synthesize_unsupported_language(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        tts_data = {"text": "hello", "language": "fr"}
        r = requests.post(f"{API_URL}/tts/synthesize", json=tts_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_tts_synthesize_empty_text(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        tts_data = {"text": "", "language": "en"}
        r = requests.post(f"{API_URL}/tts/synthesize", json=tts_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_tts_synthesize_too_long_text(self):
        headers = {"Authorization": f"Bearer {self.token}"}
        tts_data = {"text": "a" * 501, "language": "en"}
        r = requests.post(f"{API_URL}/tts/synthesize", json=tts_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)

    def test_tts_synthesize_unauthorized(self):
        tts_data = {"text": "hello", "language": "en"}
        r = requests.post(f"{API_URL}/tts/synthesize", json=tts_data, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)


def main():
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
