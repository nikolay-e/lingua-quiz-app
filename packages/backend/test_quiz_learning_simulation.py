#!/usr/bin/env python3
"""
Comprehensive Quiz Learning Simulation
Simulates a complete learning journey through the quiz system
"""

import os
import sys
import time
import requests
import random
import string
from collections import defaultdict

# Configuration
API_URL = os.getenv('API_URL', 'http://localhost:9000/api')
TIMEOUT = 2  # Fast timeout for requests
MAX_QUESTIONS = 15000  # Prevent infinite loops
MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL = 5

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

class QuizLearningSimulation:
    def __init__(self):
        self.username = None
        self.password = 'TestPassword123!'
        self.token = None
        self.word_list_name = 'German Russian A1'  # Default word list
        self.question_counter = 0
        self.consecutive_errors = 0
        self.answered_words = defaultdict(lambda: {'correct': 0, 'incorrect': 0})
        self.level_progression_history = []
        self.current_direction = 'normal'
        
        # Intentional failure testing
        self.failure_test_words = {}
        self.FAILURE_TEST_RATE = 0.05  # 5% of unique words
        self.DEGRADATION_PATTERNS = [3, 4, 5]  # Test different failure counts
        
        # Logging control for parallel runs
        self.verbose = False
        self.log_prefix = ""
        
        # Cache for next question from submit response
        self.next_question_cache = None
    
    def log(self, message, color=None, force=False):
        """Log message with optional color and prefix"""
        if self.verbose or force:
            prefix = f"[{self.log_prefix}] " if self.log_prefix else ""
            if color:
                print(f"{prefix}{color}{message}{RESET}")
            else:
                print(f"{prefix}{message}")
    
    def random_username(self):
        """Generate random test username"""
        suffix = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        return f"quiz_sim_{suffix}"
    
    def get_headers(self):
        """Get authorization headers"""
        return {'Authorization': f'Bearer {self.token}'}
    
    def register_and_login(self):
        """Register and login test user"""
        self.username = self.random_username()
        
        # Register
        user_data = {'username': self.username, 'password': self.password}
        r = requests.post(f"{API_URL}/auth/register", json=user_data, timeout=TIMEOUT)
        if r.status_code != 201:
            raise Exception(f"Registration failed: {r.text}")
        
        data = r.json()
        self.token = data['token']
        return True
    
    def start_quiz(self, word_list_name):
        """Start quiz session"""
        r = requests.post(f"{API_URL}/quiz/start",
                         json={'wordListName': word_list_name},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        if r.status_code != 200:
            raise Exception(f"Failed to start quiz: {r.text}")
        return r.json()
    
    def get_quiz_progress(self, word_list_name):
        """Get current quiz progress"""
        r = requests.get(f"{API_URL}/quiz/state",
                        params={'wordListName': word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        if r.status_code != 200:
            raise Exception(f"Failed to get progress: {r.text}")
        return r.json()
    
    def get_next_question(self, word_list_name):
        """Get next question"""
        r = requests.get(f"{API_URL}/quiz/next-question",
                        params={'wordListName': word_list_name},
                        headers=self.get_headers(),
                        timeout=TIMEOUT)
        if r.status_code != 200:
            raise Exception(f"Failed to get next question: {r.text}")
        return r.json()
    
    def submit_answer(self, translation_id, answer, displayed_word):
        """Submit answer"""
        r = requests.post(f"{API_URL}/quiz/submit-answer",
                         json={
                             'wordListName': self.word_list_name,
                             'translationId': translation_id,
                             'answer': answer,
                             'displayedWord': displayed_word
                         },
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        if r.status_code != 200:
            raise Exception(f"Failed to submit answer: {r.text}")
        return r.json()
    
    def toggle_direction(self):
        """Toggle quiz direction"""
        r = requests.post(f"{API_URL}/quiz/toggle-direction",
                         json={'wordListName': self.word_list_name},
                         headers=self.get_headers(),
                         timeout=TIMEOUT)
        if r.status_code != 200:
            raise Exception(f"Failed to toggle direction: {r.text}")
        
        result = r.json()
        self.current_direction = result['direction']
        return result
    
    def get_level_counts(self, word_lists):
        """Get word counts by level"""
        counts = {
            'level0': len(word_lists.get('level0', [])),
            'level1': len(word_lists.get('level1', [])),
            'level2': len(word_lists.get('level2', [])),
            'level3': len(word_lists.get('level3', []))
        }
        counts['total'] = sum(counts.values())
        return counts
    
    def find_correct_answer(self, question, word_lists):
        """Find the correct answer for a question"""
        word = question['word']
        direction = question['direction']
        translation_id = question['translationId']
        
        # Search through all levels
        for level_name, words in word_lists.items():
            for word_pair in words:
                if word_pair.get('id') == translation_id:
                    if direction == 'normal':
                        if word_pair.get('source') == word:
                            return word_pair.get('target')
                    else:
                        if word_pair.get('target') == word:
                            return word_pair.get('source')
        return None
    
    def should_intentionally_fail(self, translation_id, current_progress=0):
        """Determine if we should intentionally fail this word for testing"""
        # Stop intentional failures when close to completion to avoid infinite loops
        if current_progress > 0.95:  # 95% completion
            return False
            
        if translation_id not in self.failure_test_words:
            if random.random() < self.FAILURE_TEST_RATE:
                max_failures = random.choice(self.DEGRADATION_PATTERNS)
                self.failure_test_words[translation_id] = {
                    'failures': 0,
                    'max_failures': max_failures
                }
        
        if translation_id in self.failure_test_words:
            failure_data = self.failure_test_words[translation_id]
            return failure_data['failures'] < failure_data['max_failures']
        
        return False
    
    def delete_test_user(self):
        """Clean up test user"""
        if self.token:
            try:
                r = requests.delete(f"{API_URL}/auth/delete-account",
                                   headers=self.get_headers(),
                                   timeout=TIMEOUT)
                return r.status_code == 200
            except:
                pass
        return False
    
    def run_simulation(self):
        """Run the complete learning simulation"""
        self.log(f"Starting Quiz Learning Simulation", YELLOW, force=True)
        self.log(f"API URL: {API_URL}", force=False)
        
        try:
            # Setup
            if not self.register_and_login():
                return False
            
            self.log(f"Started - User: {self.username}", GREEN, force=True)
            
            # Start quiz
            session_data = self.start_quiz(self.word_list_name)
            initial_counts = self.get_level_counts(session_data['wordLists'])
            target_mastered = initial_counts['total']
            
            self.log(f"Total words: {target_mastered} (L0:{initial_counts['level0']}, L1:{initial_counts['level1']}, L2:{initial_counts['level2']}, L3:{initial_counts['level3']})", YELLOW, force=True)
            
            # Learning variables
            manual_direction_toggle = False
            force_refresh = False
            last_progress_change = 0  # Track when progress last changed
            last_level3_count = initial_counts['level3']
            
            # Main learning loop - complete all words to L3
            while (initial_counts['level3'] < target_mastered and
                   self.consecutive_errors < MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL and
                   self.question_counter < MAX_QUESTIONS):
                
                self.question_counter += 1
                
                # Progress calculation
                progress_pct = (initial_counts['level3'] / target_mastered * 100) if target_mastered > 0 else 0
                
                # Check for progress changes
                if initial_counts['level3'] > last_level3_count:
                    last_progress_change = self.question_counter
                    last_level3_count = initial_counts['level3']
                
                # Only log progress less frequently to reduce I/O overhead
                if self.question_counter % 1000 == 0 or self.question_counter == 1:
                    self.log(f"Question {self.question_counter} | Progress: {progress_pct:.1f}% ({initial_counts['level3']}/{target_mastered} L3)", BLUE, force=True)
                
                # Break if stuck for too long (no progress in 1000 questions for faster termination)
                if self.question_counter - last_progress_change > 1000:
                    self.log(f"Breaking: No progress for {self.question_counter - last_progress_change} questions", YELLOW, force=True)
                    break
                
                # Refresh session data if needed
                if force_refresh:
                    session_data = self.get_quiz_progress(self.word_list_name)
                    initial_counts = self.get_level_counts(session_data['wordLists'])
                    force_refresh = False
                
                # Get next question (always fresh to match frontend behavior)
                try:
                    question = self.get_next_question(self.word_list_name)
                except Exception as e:
                    error_msg = str(e)
                    self.log(f"ERROR getting next question: {error_msg}", RED, force=False)
                    
                    self.consecutive_errors += 1
                    force_refresh = True
                    continue
                
                # Validate question
                if not question or 'word' not in question or not question.get('word'):
                    self.log(f"ERROR invalid question format: {question}", RED, force=False)
                    self.consecutive_errors += 1
                    continue
                
                # Check if we got an error response or completion
                if 'error' in question:
                    self.log(f"Quiz error: {question.get('error')}", YELLOW, force=True)
                    break
                    
                if question.get('completed'):
                    self.log(f"🎉 {question.get('message')} 🎉", GREEN, force=True)
                    self.log(f"Total words: {question.get('totalWords')}, Mastered: {question.get('masteredWords')}", GREEN, force=True)
                    break
                
                # Check if required fields exist
                if 'translationId' not in question:
                    self.log(f"ERROR missing translationId in question: {question}", RED, force=False)
                    self.consecutive_errors += 1
                    continue
                
                word = question['word']
                translation_id = question['translationId']
                
                # Find correct answer
                correct_answer = self.find_correct_answer(question, session_data['wordLists'])
                if not correct_answer:
                    self.log(f"ERROR could not find correct answer for question: {question}", RED, force=False)
                    force_refresh = True
                    self.consecutive_errors += 1
                    continue
                
                # Determine if we should intentionally fail
                progress_pct = (initial_counts['level3'] / target_mastered) if target_mastered > 0 else 0
                intentionally_wrong = self.should_intentionally_fail(translation_id, progress_pct)
                
                if intentionally_wrong:
                    answer = "INTENTIONALLY_WRONG_ANSWER"
                    failure_data = self.failure_test_words[translation_id]
                    failure_data['failures'] += 1
                else:
                    answer = correct_answer
                
                
                # Submit answer
                try:
                    # Store counts before submission to track changes
                    old_counts = initial_counts.copy()
                    result = self.submit_answer(translation_id, answer, word)
                    feedback = result['feedback']
                    is_correct = feedback['isSuccess']
                    
                    # Track answer statistics
                    if is_correct:
                        self.answered_words[translation_id]['correct'] += 1
                    else:
                        self.answered_words[translation_id]['incorrect'] += 1
                    
                    # Process result
                    if is_correct:
                        if intentionally_wrong:
                            print(f"{RED}🚨 BUG DETECTED: Intentionally wrong answer marked as correct!{RESET}")
                            self.consecutive_errors += 1
                        else:
                            self.consecutive_errors = 0
                    else:
                        if intentionally_wrong:
                            # Don't log every intentional failure, it's too verbose
                            self.consecutive_errors = 0  # Don't count intentional failures
                        else:
                            self.log(f"ERROR unexpected wrong answer for word '{word}': gave '{answer}', expected similar to '{correct_answer}'", RED, force=False)
                            self.consecutive_errors += 1
                            force_refresh = True
                    
                    # Check for status changes
                    if result.get('statusChanged'):
                        self.level_progression_history.append({
                            'question': self.question_counter,
                            'word_id': translation_id,
                            'word': word
                        })
                    
                    # Update session data if word lists changed
                    if 'wordLists' in result:
                        session_data['wordLists'] = result['wordLists']
                        initial_counts = self.get_level_counts(result['wordLists'])
                    
                    # Note: Not caching next question to match frontend behavior
                        
                        # Log significant changes
                        if old_counts != initial_counts:
                            changes = []
                            if old_counts['level0'] != initial_counts['level0']:
                                changes.append(f"L0: {old_counts['level0']}→{initial_counts['level0']}")
                            if old_counts['level1'] != initial_counts['level1']:
                                changes.append(f"L1: {old_counts['level1']}→{initial_counts['level1']}")
                            if old_counts['level2'] != initial_counts['level2']:
                                changes.append(f"L2: {old_counts['level2']}→{initial_counts['level2']}")
                            if old_counts['level3'] != initial_counts['level3']:
                                changes.append(f"L3: {old_counts['level3']}→{initial_counts['level3']}")
                            
                            if changes:
                                self.log(f"Level changes: {', '.join(changes)}", BLUE)
                    
                except Exception as e:
                    error_msg = str(e)
                    self.log(f"ERROR submitting answer: {error_msg}", RED, force=False)
                    
                    # Handle session sync errors specifically
                    if "Session out of sync" in error_msg or "question has changed" in error_msg:
                        # Clear cached question and refresh session data
                        self.next_question_cache = None
                        force_refresh = True
                        # Don't count session sync errors as consecutive errors, just retry
                        continue
                    else:
                        self.consecutive_errors += 1
                        force_refresh = True
                
                # Check for periodic direction switching for balanced learning
                # Switch more frequently to progress words through levels faster
                if self.current_direction == 'reverse' and manual_direction_toggle and self.question_counter % 25 == 0:
                    self.log("Switching direction back to normal", force=False)
                    self.toggle_direction()
                    manual_direction_toggle = False
                    force_refresh = True
                    continue
                
                # Check for manual direction toggle for balanced learning
                if self.current_direction == 'normal' and not manual_direction_toggle:
                    if initial_counts['level2'] >= 5 or self.question_counter % 100 == 0:
                        reason = f"{initial_counts['level2']} L2 words" if initial_counts['level2'] >= 5 else f"periodic balance"
                        self.log(f"Switching to reverse direction ({reason})", force=False)
                        self.toggle_direction()
                        manual_direction_toggle = True
                        force_refresh = True
                        continue
                
            
            # Final state
            print(f"\n{YELLOW}--- Simulation Complete ---{RESET}")
            
            final_counts = self.get_level_counts(session_data['wordLists'])
            total_attempts = sum(data['correct'] + data['incorrect'] for data in self.answered_words.values())
            total_correct = sum(data['correct'] for data in self.answered_words.values())
            total_incorrect = sum(data['incorrect'] for data in self.answered_words.values())
            accuracy = (total_correct / total_attempts * 100) if total_attempts > 0 else 0
            
            # Log final results
            completion_pct = (final_counts['level3'] / target_mastered * 100) if target_mastered > 0 else 0
            self.log(f"Completed: {self.question_counter} questions, {completion_pct:.1f}% mastered ({final_counts['level3']}/{target_mastered} L3), Accuracy: {accuracy:.1f}%", YELLOW, force=True)
            
            # Only show detailed stats in verbose mode
            if self.verbose:
                print(f"\n{YELLOW}Answer Statistics:{RESET}")
                print(f"  Total attempts: {total_attempts}")
                print(f"  Correct: {total_correct}")
                print(f"  Incorrect: {total_incorrect}")
                print(f"  Accuracy: {accuracy:.1f}%")
                
                # Show most practiced words
                print(f"\n{YELLOW}Most practiced words:{RESET}")
                sorted_words = sorted(self.answered_words.items(), 
                                    key=lambda x: x[1]['correct'] + x[1]['incorrect'], reverse=True)
                for word_id, stats in sorted_words[:5]:
                    total = stats['correct'] + stats['incorrect']
                    print(f"  Word ID {word_id}: {total} attempts ({stats['correct']} correct, {stats['incorrect']} incorrect)")
                
                # Show progression events
                if self.level_progression_history:
                    print(f"\n{YELLOW}Level progression events:{RESET}")
                    for event in self.level_progression_history[:10]:  # Show first 10
                        print(f"  Question {event['question']}: Word '{event['word']}' leveled up")
                
                # Degradation testing summary
                degradation_words = len(self.failure_test_words)
                print(f"\n{YELLOW}Degradation testing:{RESET}")
                print(f"  Words tested for degradation: {degradation_words}")
                if degradation_words > 0:
                    pattern_counts = defaultdict(int)
                    for data in self.failure_test_words.values():
                        pattern_counts[data['max_failures']] += 1
                    for failures, count in sorted(pattern_counts.items()):
                        print(f"    {count} words tested with {failures} consecutive failures")
            
            # Success criteria
            completion_rate = (final_counts['level3'] / target_mastered * 100) if target_mastered > 0 else 0
            
            if self.consecutive_errors >= MAX_CONSECUTIVE_ERRORS_BEFORE_FAIL:
                self.log(f"❌ FAILED: Too many consecutive errors ({self.consecutive_errors})", RED, force=True)
                return False
            elif final_counts['level3'] == target_mastered:
                self.log(f"✅ PASSED: 100% mastered! ({target_mastered} words in {self.question_counter} questions)", GREEN, force=True)
                return True
            elif completion_rate >= 95.0:
                self.log(f"✅ PASSED: {completion_rate:.1f}% mastered ({final_counts['level3']}/{target_mastered} L3 in {self.question_counter} questions)", GREEN, force=True)
                return True
            else:
                self.log(f"❌ FAILED: Only {completion_rate:.1f}% complete ({final_counts['level3']}/{target_mastered} L3)", RED, force=True)
                return False
                
        except Exception as e:
            self.log(f"Simulation failed with error: {e}", RED, force=True)
            return False
        
        finally:
            # Cleanup
            if self.delete_test_user():
                self.log("Test user deleted", force=False)
            else:
                self.log("Failed to delete test user", YELLOW, force=False)

def run_simulation_for_word_list(word_list_name):
    """Run simulation for a specific word list"""
    simulation = QuizLearningSimulation()
    simulation.word_list_name = word_list_name
    simulation.log_prefix = word_list_name
    return simulation.run_simulation()

def main():
    """Run the quiz learning simulation for all word lists"""
    import argparse
    import concurrent.futures
    
    parser = argparse.ArgumentParser(description='Run quiz learning simulation')
    parser.add_argument('--word-list', help='Specific word list to test (optional)')
    parser.add_argument('--parallel', action='store_true', help='Force parallel execution (default for multiple word lists)')
    parser.add_argument('--sequential', action='store_true', help='Force sequential execution')
    args = parser.parse_args()
    
    if args.word_list:
        # Run for specific word list
        success = run_simulation_for_word_list(args.word_list)
        sys.exit(0 if success else 1)
    
    # Get all available word lists
    print(f"{BLUE}Fetching available word lists...{RESET}")
    
    # Create a temporary user just to get word lists
    test_creds = {
        'username': f'temp_list_check_{random.randint(1000, 9999)}',
        'password': 'TempPass123!'
    }
    
    # Register and login
    r = requests.post(f"{API_URL}/auth/register", json=test_creds, timeout=TIMEOUT)
    if r.status_code != 201:
        print(f"{RED}Failed to create temp user: {r.text}{RESET}")
        sys.exit(1)
    
    r = requests.post(f"{API_URL}/auth/login", 
                     json={'username': test_creds['username'], 'password': test_creds['password']},
                     timeout=TIMEOUT)
    if r.status_code != 200:
        print(f"{RED}Failed to login temp user{RESET}")
        sys.exit(1)
    
    token = r.json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    
    # Get word lists
    r = requests.get(f"{API_URL}/word-sets", headers=headers, timeout=TIMEOUT)
    if r.status_code != 200:
        print(f"{RED}Failed to get word lists: {r.status_code} {r.text}{RESET}")
        sys.exit(1)
    
    word_lists = [wl['name'] for wl in r.json()]
    
    # Cleanup temp user
    requests.delete(f"{API_URL}/auth/delete-account", headers=headers, timeout=TIMEOUT)
    
    print(f"\n{YELLOW}Found {len(word_lists)} word lists to test:{RESET}")
    for wl in word_lists:
        print(f"  - {wl}")
    
    if args.sequential or (len(word_lists) == 1 and not args.parallel):
        # Run simulations sequentially
        print(f"\n{YELLOW}Running simulation{'s' if len(word_lists) > 1 else ''} sequentially...{RESET}")
        results = {}
        for wl in word_lists:
            results[wl] = run_simulation_for_word_list(wl)
    else:
        # Run simulations in parallel (default for multiple word lists)
        print(f"\n{YELLOW}Running simulations in parallel...{RESET}")
        with concurrent.futures.ProcessPoolExecutor(max_workers=min(len(word_lists), 4)) as executor:
            future_to_list = {executor.submit(run_simulation_for_word_list, wl): wl 
                            for wl in word_lists}
            
            results = {}
            for future in concurrent.futures.as_completed(future_to_list):
                word_list = future_to_list[future]
                try:
                    results[word_list] = future.result()
                except Exception as exc:
                    print(f"{RED}Simulation for {word_list} failed: {exc}{RESET}")
                    results[word_list] = False
    
    # Summary
    print(f"\n{YELLOW}{'='*60}{RESET}")
    print(f"{YELLOW}SIMULATION SUMMARY{RESET}")
    print(f"{YELLOW}{'='*60}{RESET}")
    
    all_passed = True
    for wl, success in results.items():
        status = f"{GREEN}✓ PASSED{RESET}" if success else f"{RED}✗ FAILED{RESET}"
        print(f"{wl}: {status}")
        if not success:
            all_passed = False
    
    print(f"\n{YELLOW}Total: {len(results)} word lists tested{RESET}")
    passed = sum(1 for s in results.values() if s)
    print(f"{GREEN}Passed: {passed}{RESET}")
    failed = len(results) - passed
    if failed > 0:
        print(f"{RED}Failed: {failed}{RESET}")
    
    sys.exit(0 if all_passed else 1)

if __name__ == '__main__':
    main()