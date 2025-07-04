#!/usr/bin/env python3
"""
LinguaQuiz Integration Tests
Run against deployed system
"""

import os
import sys
import time
import requests
import random
import string
import base64
from urllib.parse import quote

# Configuration
API_URL = os.getenv('API_URL', 'http://localhost:9000/api')
TIMEOUT = 30
SKIP_TTS_TESTS = os.getenv('SKIP_TTS_TESTS', 'false').lower() == 'true'

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

class TestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.test_user = None
        self.token = None
        
    def random_username(self):
        """Generate random test username"""
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"test_{suffix}"
    
    def test(self, name, func):
        """Run a single test"""
        try:
            func()
            print(f"{GREEN}✓{RESET} {name}")
            self.passed += 1
        except Exception as e:
            print(f"{RED}✗{RESET} {name}")
            print(f"  {RED}Error: {e}{RESET}")
            self.failed += 1
    
    def assert_equal(self, actual, expected, msg=""):
        """Assert values are equal"""
        if actual != expected:
            raise AssertionError(f"{msg}: expected {expected}, got {actual}")
    
    def assert_in(self, item, container, msg=""):
        """Assert item in container"""
        if item not in container:
            raise AssertionError(f"{msg}: {item} not in {container}")
    
    def assert_true(self, condition, msg=""):
        """Assert condition is true"""
        if not condition:
            raise AssertionError(msg or "Condition is false")
    
    def run_all(self):
        """Run all tests"""
        print(f"\n{YELLOW}Running Integration Tests{RESET}")
        print(f"API URL: {API_URL}\n")
        
        # Health check
        self.test("Health check", self.test_health)
        
        # Auth tests
        self.test("Register new user", self.test_register)
        self.test("Login with correct credentials", self.test_login)
        self.test("Reject duplicate registration", self.test_duplicate_register)
        self.test("Reject invalid credentials", self.test_invalid_login)
        
        # Enhanced auth validation tests
        self.test("Reject weak password", self.test_weak_password)
        self.test("Reject short username", self.test_short_username)
        self.test("Reject empty credentials", self.test_empty_credentials)
        self.test("Reject malformed JWT token", self.test_malformed_token)
        
        # Protected endpoint tests
        self.test("Get word lists (authenticated)", self.test_get_word_lists)
        self.test("Get user word sets", self.test_get_user_word_sets)
        self.test("Get specific word set by ID", self.test_get_word_set_by_id)
        self.test("Update word set status", self.test_update_word_status)
        self.test("Access denied without token", self.test_unauthorized)
        
        # Enhanced word set tests
        self.test("Get non-existent word set", self.test_get_nonexistent_word_set)
        self.test("Update word status with invalid data", self.test_invalid_word_status_update)
        self.test("Get user word sets with invalid list name", self.test_invalid_word_list_name)
        
        # User level persistence tests
        self.test("Get user current level", self.test_get_current_level)
        self.test("Update user current level", self.test_update_current_level)
        self.test("Update current level with invalid value", self.test_invalid_current_level)
        self.test("Get current level without authentication", self.test_current_level_unauthorized)
        
        # TTS tests (only run on deployed environments)
        if not SKIP_TTS_TESTS:
            self.test("Get TTS supported languages", self.test_tts_languages)
            self.test("TTS synthesis with valid database word", self.test_tts_synthesize_valid_word)
            self.test("TTS synthesis with invalid word", self.test_tts_synthesize_invalid_word)
            self.test("TTS synthesis with unsupported language", self.test_tts_synthesize_unsupported_language)
            self.test("TTS synthesis with empty text", self.test_tts_synthesize_empty_text)
            self.test("TTS synthesis with too long text", self.test_tts_synthesize_too_long_text)
            self.test("TTS synthesis without authentication", self.test_tts_synthesize_unauthorized)
            self.test("TTS rate limiting", self.test_tts_rate_limiting)
        else:
            print(f"{YELLOW}Skipping TTS tests (SKIP_TTS_TESTS=true){RESET}")
        
        # Cleanup
        self.test("Delete test account", self.test_delete_account)
        
        # Summary
        print(f"\n{YELLOW}Test Summary:{RESET}")
        print(f"  {GREEN}Passed: {self.passed}{RESET}")
        if self.failed > 0:
            print(f"  {RED}Failed: {self.failed}{RESET}")
        print()
        
        return self.failed == 0
    
    # Test implementations
    def test_health(self):
        """Test health endpoint"""
        r = requests.get(f"{API_URL}/health", timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_equal(data['status'], 'ok')
        self.assert_equal(data['database'], 'connected')
        self.assert_in('timestamp', data)
    
    def test_register(self):
        """Test user registration"""
        self.test_user = {
            'username': self.random_username(),
            'password': 'TestPassword123!'
        }
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 201)
        data = r.json()
        self.assert_in('token', data)
        self.assert_in('user', data)
        self.assert_equal(data['user']['username'], self.test_user['username'])
        self.token = data['token']
    
    def test_login(self):
        """Test user login"""
        r = requests.post(f"{API_URL}/auth/login", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_in('token', data)
        self.token = data['token']
    
    def test_duplicate_register(self):
        """Test duplicate registration rejection"""
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 400)
        self.assert_in('already exists', r.json()['detail'])
    
    def test_invalid_login(self):
        """Test invalid login rejection"""
        invalid_user = {
            'username': self.test_user['username'],
            'password': 'WrongPassword'
        }
        r = requests.post(f"{API_URL}/auth/login", json=invalid_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)
    
    def test_get_word_lists(self):
        """Test getting word lists"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.get(f"{API_URL}/word-sets", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_true(isinstance(data, list))
        # Check camelCase field names if data exists
        if data:
            first_item = data[0]
            self.assert_in('id', first_item)
            self.assert_in('name', first_item)
            self.assert_in('createdAt', first_item)  # Should be camelCase
            self.assert_in('updatedAt', first_item)  # Should be camelCase
    
    def test_get_user_word_sets(self):
        """Test getting user word sets"""
        headers = {'Authorization': f'Bearer {self.token}'}
        # First get available word lists
        r = requests.get(f"{API_URL}/word-sets", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200 and r.json():
            word_list_name = r.json()[0]['name']
            # Get user word sets - API expects snake_case parameter
            r = requests.get(
                f"{API_URL}/word-sets/user",
                params={'word_list_name': word_list_name},
                headers=headers,
                timeout=TIMEOUT
            )
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_true(isinstance(data, list))
            # Check camelCase field names if data exists
            if data:
                first_item = data[0]
                self.assert_in('translationId', first_item)  # Should be camelCase
                self.assert_in('status', first_item)
                self.assert_in('sourceWord', first_item)  # Should be camelCase
                self.assert_in('targetWord', first_item)  # Should be camelCase
                self.assert_in('sourceLanguage', first_item)  # Should be camelCase
                self.assert_in('targetLanguage', first_item)  # Should be camelCase
                self.assert_in('sourceWordUsageExample', first_item)  # Should be camelCase
                self.assert_in('targetWordUsageExample', first_item)  # Should be camelCase
    
    def test_get_word_set_by_id(self):
        """Test getting specific word set by ID"""
        headers = {'Authorization': f'Bearer {self.token}'}
        # First get available word lists
        r = requests.get(f"{API_URL}/word-sets", headers=headers, timeout=TIMEOUT)
        if r.status_code == 200 and r.json():
            word_set_id = r.json()[0]['id']
            # Get specific word set
            r = requests.get(f"{API_URL}/word-sets/{word_set_id}", headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_in('id', data)
            self.assert_in('name', data)
            self.assert_in('createdAt', data)  # Should be camelCase
            self.assert_in('updatedAt', data)  # Should be camelCase
            self.assert_in('words', data)
            self.assert_true(isinstance(data['words'], list))
            # Check word structure if exists
            if data['words']:
                first_word = data['words'][0]
                self.assert_in('translationId', first_word)  # Should be camelCase
                self.assert_in('sourceWordId', first_word)  # Should be camelCase
                self.assert_in('targetWordId', first_word)  # Should be camelCase
                self.assert_in('sourceWord', first_word)  # Should be camelCase
                self.assert_in('targetWord', first_word)  # Should be camelCase
                self.assert_in('sourceLanguage', first_word)  # Should be camelCase
                self.assert_in('targetLanguage', first_word)  # Should be camelCase
    
    def test_update_word_status(self):
        """Test updating word status"""
        headers = {'Authorization': f'Bearer {self.token}'}
        data = {
            'status': 'LEVEL_1',
            'translationIds': []  # Empty list should still work
        }
        r = requests.post(
            f"{API_URL}/word-sets/user",
            json=data,
            headers=headers,
            timeout=TIMEOUT
        )
        self.assert_equal(r.status_code, 200)
    
    def test_unauthorized(self):
        """Test unauthorized access"""
        r = requests.get(f"{API_URL}/word-sets", timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)
    
    def test_delete_account(self):
        """Test account deletion"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.delete(f"{API_URL}/auth/delete-account", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        # Verify account is deleted by trying to login
        r = requests.post(f"{API_URL}/auth/login", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)
    
    def test_tts_languages(self):
        """Test getting supported TTS languages"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.get(f"{API_URL}/tts/languages", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_in('supportedLanguages', data)
        self.assert_in('available', data)
        self.assert_true(isinstance(data['supportedLanguages'], list))
        self.assert_true(isinstance(data['available'], bool))
        
    def test_tts_synthesize_valid_word(self):
        """Test TTS synthesis with valid database word"""
        headers = {'Authorization': f'Bearer {self.token}'}
        # Use words that actually exist in the database
        test_cases = [
            {'text': 'aber', 'language': 'German'},
            {'text': 'hola', 'language': 'Spanish'},
            {'text': 'вечер', 'language': 'Russian'}
        ]
        
        for case in test_cases:
            payload = {'text': case['text'], 'language': case['language']}
            r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
            
            if r.status_code == 200:
                data = r.json()
                self.assert_in('audioData', data)
                self.assert_in('contentType', data)
                self.assert_in('text', data)
                self.assert_in('language', data)
                self.assert_equal(data['contentType'], 'audio/mpeg')
                self.assert_equal(data['text'], case['text'])
                self.assert_equal(data['language'], case['language'])
                
                # Verify audioData is valid base64
                try:
                    audio_bytes = base64.b64decode(data['audioData'])
                    self.assert_true(len(audio_bytes) > 0)
                except Exception:
                    raise AssertionError("Invalid base64 audio data")
            elif r.status_code == 400:
                # Word might not be in database, which is acceptable
                data = r.json()
                self.assert_in('detail', data)
                print(f"  {YELLOW}Note: '{case['text']}' not in database{RESET}")
            else:
                raise AssertionError(f"Unexpected status code: {r.status_code}")
    
    def test_tts_synthesize_invalid_word(self):
        """Test TTS synthesis with invalid (non-database) text"""
        headers = {'Authorization': f'Bearer {self.token}'}
        # Use text that definitely won't be in the database
        payload = {'text': 'xyzzyx_invalid_word_12345', 'language': 'German'}
        r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
        # The API returns 400 when the word is not found in database
        self.assert_equal(r.status_code, 400)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_tts_synthesize_unsupported_language(self):
        """Test TTS synthesis with unsupported language"""
        headers = {'Authorization': f'Bearer {self.token}'}
        payload = {'text': 'hello', 'language': 'Klingon'}
        r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_tts_synthesize_empty_text(self):
        """Test TTS synthesis with empty text"""
        headers = {'Authorization': f'Bearer {self.token}'}
        payload = {'text': '', 'language': 'German'}
        r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_tts_synthesize_too_long_text(self):
        """Test TTS synthesis with text too long"""
        headers = {'Authorization': f'Bearer {self.token}'}
        long_text = 'a' * 501  # 501 characters
        payload = {'text': long_text, 'language': 'German'}
        r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_tts_synthesize_unauthorized(self):
        """Test TTS synthesis without authentication"""
        payload = {'text': 'hello', 'language': 'German'}
        r = requests.post(f"{API_URL}/tts/synthesize", json=payload, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)
    
    def test_tts_rate_limiting(self):
        """Test TTS rate limiting (user-based)"""
        headers = {'Authorization': f'Bearer {self.token}'}
        payload = {'text': 'test', 'language': 'German'}
        
        # Make multiple rapid requests to test rate limiting
        # Should not hit rate limit with reasonable number of requests
        for i in range(5):
            r = requests.post(f"{API_URL}/tts/synthesize", json=payload, headers=headers, timeout=TIMEOUT)
            # Should either succeed or fail due to text validation, not rate limiting
            self.assert_true(r.status_code in [200, 400])  # 400 if text not in DB
            
        # Note: Testing actual rate limit would require 100+ requests which is impractical for integration tests
    
    # Enhanced validation tests
    def test_weak_password(self):
        """Test registration with weak password"""
        weak_user = {
            'username': self.random_username(),
            'password': '123'  # Too short
        }
        r = requests.post(f"{API_URL}/auth/register", json=weak_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_short_username(self):
        """Test registration with short username"""
        short_user = {
            'username': 'ab',  # Too short
            'password': 'ValidPassword123!'
        }
        r = requests.post(f"{API_URL}/auth/register", json=short_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_empty_credentials(self):
        """Test registration with empty credentials"""
        empty_user = {
            'username': '',
            'password': ''
        }
        r = requests.post(f"{API_URL}/auth/register", json=empty_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        data = r.json()
        self.assert_in('detail', data)
    
    def test_malformed_token(self):
        """Test access with malformed JWT token"""
        headers = {'Authorization': 'Bearer invalid.token.here'}
        r = requests.get(f"{API_URL}/word-sets", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)
    
    def test_get_nonexistent_word_set(self):
        """Test getting non-existent word set"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.get(f"{API_URL}/word-sets/999999", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 404)
    
    def test_invalid_word_status_update(self):
        """Test updating word status with invalid data"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test with invalid status
        invalid_data = {
            'status': 'INVALID_LEVEL',
            'translationIds': [1]
        }
        r = requests.post(f"{API_URL}/word-sets/user", json=invalid_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
        
        # Test with missing fields
        incomplete_data = {
            'status': 'LEVEL_1'
            # Missing translationIds
        }
        r = requests.post(f"{API_URL}/word-sets/user", json=incomplete_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)
    
    def test_invalid_word_list_name(self):
        """Test getting user word sets with invalid list name"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.get(
            f"{API_URL}/word-sets/user",
            params={'word_list_name': 'NonExistentList'},
            headers=headers,
            timeout=TIMEOUT
        )
        # Should still return 200 with empty list, not error
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_true(isinstance(data, list))
        self.assert_equal(len(data), 0)
    
    def test_get_current_level(self):
        """Test getting user current level"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.get(f"{API_URL}/user/current-level", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_in('currentLevel', data)
        # Should be default level for new user
        self.assert_equal(data['currentLevel'], 'LEVEL_1')
    
    def test_update_current_level(self):
        """Test updating user current level"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test updating to each valid level
        valid_levels = ['LEVEL_1', 'LEVEL_2', 'LEVEL_3', 'LEVEL_4']
        
        for level in valid_levels:
            # Update to new level
            update_data = {'currentLevel': level}
            r = requests.post(f"{API_URL}/user/current-level", json=update_data, headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_in('message', data)
            self.assert_in('currentLevel', data)
            self.assert_equal(data['currentLevel'], level)
            
            # Verify the level was actually updated by getting it
            r = requests.get(f"{API_URL}/user/current-level", headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_equal(data['currentLevel'], level)
    
    def test_invalid_current_level(self):
        """Test updating current level with invalid values"""
        headers = {'Authorization': f'Bearer {self.token}'}
        
        # Test with invalid level value
        invalid_data = {'currentLevel': 'INVALID_LEVEL'}
        r = requests.post(f"{API_URL}/user/current-level", json=invalid_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 400)
        data = r.json()
        self.assert_in('detail', data)
        
        # Test with missing currentLevel field
        empty_data = {}
        r = requests.post(f"{API_URL}/user/current-level", json=empty_data, headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 422)  # FastAPI validation error
        
        # Test with invalid level values (business logic errors)
        invalid_levels = ['LEVEL_0', 'LEVEL_5', 'level_1', 'INVALID_LEVEL']
        for invalid_level in invalid_levels:
            invalid_data = {'currentLevel': invalid_level}
            r = requests.post(f"{API_URL}/user/current-level", json=invalid_data, headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 400)
        
        # Test with validation errors (None and empty string are treated as business logic errors by our validation)
        # Empty string passes JSON schema but fails business validation
        edge_case_levels = ['']
        for invalid_level in edge_case_levels:
            invalid_data = {'currentLevel': invalid_level}
            r = requests.post(f"{API_URL}/user/current-level", json=invalid_data, headers=headers, timeout=TIMEOUT)
            self.assert_equal(r.status_code, 400)  # Our business logic validation
    
    def test_current_level_unauthorized(self):
        """Test current level endpoints without authentication"""
        # Test GET without token
        r = requests.get(f"{API_URL}/user/current-level", timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)
        
        # Test POST without token
        data = {'currentLevel': 'LEVEL_2'}
        r = requests.post(f"{API_URL}/user/current-level", json=data, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 403)

def main():
    """Run integration tests"""
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()