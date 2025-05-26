#!/usr/bin/env python3
"""
Quiz Integration Tests for LinguaQuiz Backend
Tests all quiz-related endpoints and functionality
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
BLUE = '\033[94m'
RESET = '\033[0m'

class QuizIntegrationTester:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        self.test_user = None
        self.token = None
        self.word_list_name = None
        
    def random_email(self):
        """Generate random test email"""
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"quiz_test_{suffix}@example.com"
    
    def get_headers(self):
        """Get authorization headers"""
        return {'Authorization': f'Bearer {self.token}'}
    
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
        """Run all quiz integration tests"""
        print(f"\n{YELLOW}Running Quiz Integration Tests{RESET}")
        print(f"API URL: {API_URL}\n")
        
        # Setup
        self.test("Setup: Register test user", self.test_register)
        self.test("Setup: Get available word lists", self.test_get_word_lists)
        
        # Quiz session tests
        self.test("Start quiz session", self.test_start_quiz)
        self.test("Get quiz state", self.test_get_quiz_state)
        self.test("Get next question", self.test_get_next_question)
        self.test("Submit correct answer", self.test_correct_answer)
        self.test("Submit incorrect answer", self.test_incorrect_answer)
        self.test("Test answer validation", self.test_answer_validation)
        self.test("Toggle quiz direction", self.test_toggle_direction)
        self.test("Test question progression", self.test_question_progression)
        self.test("Test session state management", self.test_session_state)
        self.test("Test word level progression", self.test_word_progression)
        self.test("Test error handling", self.test_error_handling)
        self.test("Test answer field name compatibility", self.test_answer_field_compatibility)
        self.test("Test empty answer handling", self.test_empty_answer)
        self.test("Test concurrent session handling", self.test_concurrent_sessions)
        self.test("Test special characters in answers", self.test_special_characters)
        self.test("Test case insensitive answers", self.test_case_insensitive)
        
        # Cleanup
        self.test("Cleanup: Delete test account", self.test_delete_account)
        
        # Summary
        print(f"\n{YELLOW}Quiz Test Summary:{RESET}")
        print(f"  {GREEN}Passed: {self.passed}{RESET}")
        if self.failed > 0:
            print(f"  {RED}Failed: {self.failed}{RESET}")
        print()
        
        return self.failed == 0
    
    def test_register(self):
        """Register a test user"""
        self.test_user = {
            'email': self.random_email(),
            'password': 'TestPassword123!'
        }
        r = requests.post(f"{API_URL}/auth/register", json=self.test_user, timeout=TIMEOUT)
        self.assert_equal(r.status_code, 201)
        data = r.json()
        self.assert_in('token', data)
        self.token = data['token']
    
    def test_get_word_lists(self):
        """Get available word lists"""
        r = requests.get(f"{API_URL}/word-sets", headers=self.get_headers(), timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        self.assert_true(isinstance(data, list))
        self.assert_true(len(data) > 0, "No word lists available")
        self.word_list_name = data[0]['name']
    
    def test_start_quiz(self):
        """Test starting a quiz session"""
        r = requests.post(f"{API_URL}/quiz/start", 
                         json={'wordListName': self.word_list_name},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        
        # Check response structure
        self.assert_in('direction', data)
        self.assert_in('wordLists', data)
        self.assert_in('sessionId', data)
        self.assert_in('currentTranslationId', data)
        
        # Check word lists structure
        word_lists = data['wordLists']
        for level in ['level0', 'level1', 'level2', 'level3']:
            self.assert_in(level, word_lists)
            self.assert_true(isinstance(word_lists[level], list))
    
    def test_get_quiz_state(self):
        """Test getting quiz state"""
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        
        # Check response structure
        self.assert_in('direction', data)
        self.assert_in('wordLists', data)
        self.assert_in('sessionId', data)
        self.assert_in('currentTranslationId', data)
    
    def test_get_next_question(self):
        """Test getting next question"""
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        data = r.json()
        
        # Check question structure
        self.assert_in('word', data)
        self.assert_in('translationId', data)
        self.assert_in('direction', data)
        self.assert_in('sourceLanguage', data)
        self.assert_in('targetLanguage', data)
        
        # Validate direction
        self.assert_in(data['direction'], ['normal', 'reverse'])
        
        # Store for next tests
        self.current_question = data
    
    def test_correct_answer(self):
        """Test submitting a correct answer"""
        # Get a fresh question first
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Get the word lists to find the correct answer
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        progress_data = r.json()
        
        # Find the correct answer from word lists
        correct_answer = self.find_correct_answer(question, progress_data['wordLists'])
        self.assert_true(correct_answer is not None, "Could not find correct answer")
        
        # Submit the correct answer
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': question['translationId'],
                             'answer': correct_answer,
                             'displayedWord': question['word']
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        
        self.assert_equal(r.status_code, 200)
        result = r.json()
        
        # Check response structure
        self.assert_in('feedback', result)
        self.assert_in('usageExamples', result)
        self.assert_in('statusChanged', result)
        self.assert_in('wordLists', result)
        self.assert_in('nextQuestion', result)
        
        # Check feedback
        feedback = result['feedback']
        self.assert_in('message', feedback)
        self.assert_in('isSuccess', feedback)
        self.assert_true(feedback['isSuccess'])
    
    def test_incorrect_answer(self):
        """Test submitting an incorrect answer"""
        # Get a fresh question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Submit an intentionally wrong answer
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': question['translationId'],
                             'answer': 'DEFINITELY_WRONG_ANSWER',
                             'displayedWord': question['word']
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        
        self.assert_equal(r.status_code, 200)
        result = r.json()
        
        # Check that it's marked as incorrect
        feedback = result['feedback']
        self.assert_in('isSuccess', feedback)
        self.assert_equal(feedback['isSuccess'], False)
    
    def test_answer_validation(self):
        """Test answer validation and normalization"""
        # Get a fresh question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Test with mismatched translation ID (should fail)
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': 999999,  # Invalid ID
                             'answer': 'test',
                             'displayedWord': question['word']
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        
        # Should return 400 for invalid translation ID
        self.assert_equal(r.status_code, 400)
    
    def test_toggle_direction(self):
        """Test toggling quiz direction"""
        # Get initial direction
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        initial_data = r.json()
        initial_direction = initial_data['direction']
        
        # Toggle direction
        r = requests.post(f"{API_URL}/quiz/toggle-direction",
                         json={'wordListName': self.word_list_name},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        toggle_data = r.json()
        
        # Check that direction changed
        self.assert_in('direction', toggle_data)
        self.assert_true(toggle_data['direction'] != initial_direction)
        
        # Verify with state check
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        final_data = r.json()
        self.assert_equal(final_data['direction'], toggle_data['direction'])
    
    def test_question_progression(self):
        """Test that questions progress through different words"""
        questions = []
        
        # Get first question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        questions.append(question['word'])
        
        # Get subsequent questions through submit responses
        for i in range(2):
            # Submit a dummy answer to move to next question
            r = requests.post(f"{API_URL}/quiz/submit-answer",
                             json={
                                 'wordListName': self.word_list_name,
                                 'translationId': question['translationId'],
                                 'answer': 'dummy',
                                 'displayedWord': question['word']
                             },
                             headers=self.get_headers(),
                             timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            result = r.json()
            
            # Use nextQuestion from response
            if 'nextQuestion' in result and result['nextQuestion'] and not result['nextQuestion'].get('error'):
                question = result['nextQuestion']
                questions.append(question['word'])
        
        # Verify we got different questions
        self.assert_true(len(set(questions)) > 1, "Questions should vary")
    
    def test_session_state(self):
        """Test session state consistency"""
        # Get session state multiple times and verify consistency
        states = []
        for i in range(2):
            r = requests.get(f"{API_URL}/quiz/state",
                            params={'wordListName': self.word_list_name},
                            headers=self.get_headers(),
                            timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            states.append(r.json())
        
        # Session ID should be consistent
        self.assert_equal(states[0]['sessionId'], states[1]['sessionId'])
    
    def test_word_progression(self):
        """Test word level progression mechanics"""
        # Get initial state
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        initial_state = r.json()
        
        # Try to answer several questions correctly to trigger progression
        for attempt in range(10):  # Try up to 10 questions
            # Get question
            r = requests.get(f"{API_URL}/quiz/next-question",
                            params={'wordListName': self.word_list_name},
                            headers=self.get_headers(),
                            timeout=TIMEOUT)
            if r.status_code != 200:
                continue
            
            question = r.json()
            
            # Find correct answer
            r = requests.get(f"{API_URL}/quiz/state",
                            params={'wordListName': self.word_list_name},
                            headers=self.get_headers(),
                            timeout=TIMEOUT)
            if r.status_code != 200:
                continue
            
            progress_data = r.json()
            correct_answer = self.find_correct_answer(question, progress_data['wordLists'])
            
            if correct_answer:
                # Submit correct answer
                r = requests.post(f"{API_URL}/quiz/submit-answer",
                               json={
                                   'wordListName': self.word_list_name,
                                   'translationId': question['translationId'],
                                   'answer': correct_answer,
                                   'displayedWord': question['word']
                               },
                               headers=self.get_headers(),
                               timeout=TIMEOUT)
                
                if r.status_code == 200:
                    result = r.json()
                    if result.get('statusChanged'):
                        print(f"  {BLUE}Word progression detected!{RESET}")
                        break
        
        # Verify final state has some progression
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        final_state = r.json()
        
        # Check that we have some words in higher levels
        total_advanced = (len(final_state['wordLists']['level1']) + 
                         len(final_state['wordLists']['level2']) + 
                         len(final_state['wordLists']['level3']))
        
        self.assert_true(total_advanced > 0, "Expected some word progression")
    
    def test_error_handling(self):
        """Test error handling for invalid requests"""
        # Test with non-existent word list
        r = requests.post(f"{API_URL}/quiz/start",
                         json={'wordListName': 'NonExistentList'},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_true(r.status_code in [404, 400])
        
        # Test without authentication
        r = requests.post(f"{API_URL}/quiz/start",
                         json={'wordListName': self.word_list_name},
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 401)
    
    def test_answer_field_compatibility(self):
        """Test that both 'answer' and 'userAnswer' field names work"""
        # Get a question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Test with 'answer' field (correct field name)
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': question['translationId'],
                             'answer': 'test_answer'
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
    
    def test_empty_answer(self):
        """Test handling of empty answers"""
        # Get a question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Submit empty answer
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': question['translationId'],
                             'answer': ''
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        result = r.json()
        
        # Empty answer should be marked as incorrect
        feedback = result['feedback']
        self.assert_equal(feedback['isSuccess'], False)
    
    def test_concurrent_sessions(self):
        """Test that multiple sessions don't interfere"""
        # Start a quiz with one word list
        r = requests.post(f"{API_URL}/quiz/start",
                         json={'wordListName': self.word_list_name},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        first_session = r.json()
        
        # Get available word lists
        r = requests.get(f"{API_URL}/word-sets", headers=self.get_headers(), timeout=TIMEOUT)
        word_lists = r.json()
        
        if len(word_lists) > 1:
            # Start another session with a different word list
            second_word_list = word_lists[1]['name']
            r = requests.post(f"{API_URL}/quiz/start",
                             json={'wordListName': second_word_list},
                             headers=self.get_headers(),
                             timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            second_session = r.json()
            
            # Verify sessions are different
            self.assert_true(first_session['sessionId'] != second_session['sessionId'])
    
    def test_special_characters(self):
        """Test answers with special characters and accents"""
        # Get a question
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        # Submit answer with special characters
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': question['translationId'],
                             'answer': 'тест ñ é ü ß'
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
    
    def test_case_insensitive(self):
        """Test that answers are case insensitive"""
        # Get question and correct answer
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
        question = r.json()
        
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': self.word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        state_data = r.json()
        
        correct_answer = self.find_correct_answer(question, state_data['wordLists'])
        if correct_answer:
            # Submit answer in different case
            mixed_case_answer = ''.join(
                c.upper() if i % 2 == 0 else c.lower() 
                for i, c in enumerate(correct_answer)
            )
            
            r = requests.post(f"{API_URL}/quiz/submit-answer",
                             json={
                                 'wordListName': self.word_list_name,
                                 'translationId': question['translationId'],
                                 'answer': mixed_case_answer
                             },
                             headers=self.get_headers(),
                             timeout=TIMEOUT)
            self.assert_equal(r.status_code, 200)
            result = r.json()
            
            # Should still be correct despite case differences
            feedback = result['feedback']
            self.assert_true(feedback['isSuccess'])
    
    def test_delete_account(self):
        """Delete test account"""
        r = requests.delete(f"{API_URL}/auth/delete-account", 
                           headers=self.get_headers(), 
                           timeout=TIMEOUT)
        self.assert_equal(r.status_code, 200)
    
    def find_correct_answer(self, question, word_lists):
        """Find the correct answer for a question from word lists"""
        word = question['word']
        direction = question['direction']
        translation_id = question['translationId']
        
        # Search through all levels to find the word pair
        for level_name, words in word_lists.items():
            for word_pair in words:
                if word_pair.get('id') == translation_id:
                    if direction == 'normal':
                        # Question shows source, answer is target
                        if word_pair.get('source') == word:
                            return word_pair.get('target')
                    else:
                        # Question shows target, answer is source
                        if word_pair.get('target') == word:
                            return word_pair.get('source')
        
        return None

def main():
    """Run quiz integration tests"""
    tester = QuizIntegrationTester()
    success = tester.run_all()
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()