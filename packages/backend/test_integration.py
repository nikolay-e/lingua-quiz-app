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

# Configuration
API_URL = os.getenv('API_URL', 'http://localhost:9000/api')
TIMEOUT = 30

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
        
    def random_email(self):
        """Generate random test email"""
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"test_{suffix}@example.com"
    
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
        
        # Protected endpoint tests
        self.test("Get word lists (authenticated)", self.test_get_word_lists)
        self.test("Get user word sets", self.test_get_user_word_sets)
        self.test("Get specific word set by ID", self.test_get_word_set_by_id)
        self.test("Update word set status", self.test_update_word_status)
        self.test("Access denied without token", self.test_unauthorized)
        
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
        self.assert_in('components', data)
    
    def test_register(self):
        """Test user registration"""
        self.test_user = {
            'email': self.random_email(),
            'password': 'TestPassword123!'
        }
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 201)
        data = r.json()
        self.assert_in('token', data)
        self.assert_in('user', data)
        self.assert_equal(data['user']['email'], self.test_user['email'])
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
        self.assert_equal(r.status_code, 409)
        self.assert_in('Conflict', r.json()['message'])
    
    def test_invalid_login(self):
        """Test invalid login rejection"""
        invalid_user = {
            'email': self.test_user['email'],
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
            # Get user word sets
            r = requests.get(
                f"{API_URL}/word-sets/user",
                params={'wordListName': word_list_name},
                headers=headers,
                timeout=TIMEOUT
            )
            self.assert_equal(r.status_code, 200)
            data = r.json()
            self.assert_true(isinstance(data, list))
            # Check camelCase field names if data exists
            if data:
                first_item = data[0]
                self.assert_in('wordPairId', first_item)  # Should be camelCase
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
            'wordPairIds': []  # Empty list should still work
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
        self.assert_equal(r.status_code, 401)
    
    def test_delete_account(self):
        """Test account deletion"""
        headers = {'Authorization': f'Bearer {self.token}'}
        r = requests.delete(f"{API_URL}/auth/delete-account", headers=headers, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        # Verify account is deleted by trying to login
        r = requests.post(f"{API_URL}/auth/login", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)

def main():
    """Run integration tests"""
    runner = TestRunner()
    success = runner.run_all()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()