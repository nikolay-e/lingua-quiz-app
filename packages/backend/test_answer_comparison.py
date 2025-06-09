#!/usr/bin/env python3
"""
LinguaQuiz Answer Comparison Logic Tests
Integration tests for the new grouping rules and comparison logic
"""

import os
import sys
import requests
import json

# Configuration
API_URL = os.getenv('API_URL', 'http://localhost:9000/api')
TIMEOUT = 30

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
RESET = '\033[0m'

class AnswerComparisonTestRunner:
    def __init__(self):
        self.passed = 0
        self.failed = 0
        
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
            raise AssertionError(f"{msg}\nExpected: {expected}\nActual: {actual}")
    
    def assert_true(self, value, msg=""):
        """Assert value is true"""
        if not value:
            raise AssertionError(f"{msg}\nExpected: True\nActual: {value}")
    
    def assert_false(self, value, msg=""):
        """Assert value is false"""
        if value:
            raise AssertionError(f"{msg}\nExpected: False\nActual: {value}")
    
    def test_answer_comparison(self, user_answer, correct_answer, expected_result, description=""):
        """Test a single answer comparison"""
        try:
            r = requests.post(f"{API_URL}/test/answer-comparison", 
                            json={
                                'userAnswer': user_answer,
                                'correctAnswer': correct_answer
                            }, 
                            timeout=TIMEOUT)
            
            if r.status_code == 403:
                print(f"{YELLOW}⚠{RESET} Test endpoint blocked (production mode)")
                return
            
            self.assert_equal(r.status_code, 200, f"API call failed for: {description}")
            data = r.json()
            
            actual_result = data['result']['isCorrect']
            self.assert_equal(actual_result, expected_result, 
                            f"Answer comparison failed for: {description}\n"
                            f"User answer: '{user_answer}'\n"
                            f"Correct answer: '{correct_answer}'\n"
                            f"Group expansions: {data['result']['groupExpansions']}\n"
                            f"Bracket alternatives: {data['result']['bracketAlternatives']}")
            
            # Print debug info for failing tests
            if actual_result != expected_result:
                print(f"  Debug info: {json.dumps(data, indent=2, ensure_ascii=False)}")
                
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"API request failed: {e}")
    
    def run_all_tests(self):
        """Run all answer comparison tests"""
        print(f"{YELLOW}Running Answer Comparison Logic Tests...{RESET}\n")
        
        # Test 1: Parentheses Grouping - Basic
        self.test("Parentheses Grouping - First alternatives", 
                 lambda: self.test_answer_comparison(
                     "равный, сейчас", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Basic grouping with first alternatives"))
        
        self.test("Parentheses Grouping - Mixed alternatives", 
                 lambda: self.test_answer_comparison(
                     "одинаковый, сразу", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Basic grouping with mixed alternatives"))
        
        self.test("Parentheses Grouping - Cross alternatives", 
                 lambda: self.test_answer_comparison(
                     "равный, сразу", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Basic grouping with cross alternatives"))
        
        self.test("Parentheses Grouping - Order independence", 
                 lambda: self.test_answer_comparison(
                     "сейчас, равный", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Order should not matter"))
        
        self.test("Parentheses Grouping - Incomplete answer", 
                 lambda: self.test_answer_comparison(
                     "равный", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     False,
                     "Should reject incomplete answers"))
        
        self.test("Parentheses Grouping - Wrong alternative", 
                 lambda: self.test_answer_comparison(
                     "неправильный, сейчас", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     False,
                     "Should reject wrong alternatives"))
        
        # Test 2: Complex Grouping with German examples
        self.test("German stimmen - Correct first meaning", 
                 lambda: self.test_answer_comparison(
                     "быть верным, голосовать", 
                     "(быть верным|быть правильным), голосовать", 
                     True,
                     "German stimmen with first synonym"))
        
        self.test("German stimmen - Correct second meaning", 
                 lambda: self.test_answer_comparison(
                     "быть правильным, голосовать", 
                     "(быть верным|быть правильным), голосовать", 
                     True,
                     "German stimmen with second synonym"))
        
        self.test("German laufen - Mixed grouping", 
                 lambda: self.test_answer_comparison(
                     "бежать, ходить", 
                     "бежать, (ходить|идти)", 
                     True,
                     "German laufen with first synonym of second group"))
        
        self.test("German laufen - Mixed grouping alt", 
                 lambda: self.test_answer_comparison(
                     "бежать, идти", 
                     "бежать, (ходить|идти)", 
                     True,
                     "German laufen with second synonym of second group"))
        
        # Test 3: Traditional Pipe Separation (no parentheses)
        self.test("Simple pipes - First alternative", 
                 lambda: self.test_answer_comparison(
                     "спасибо", 
                     "спасибо|благодарю", 
                     True,
                     "Simple pipe separation - first"))
        
        self.test("Simple pipes - Second alternative", 
                 lambda: self.test_answer_comparison(
                     "благодарю", 
                     "спасибо|благодарю", 
                     True,
                     "Simple pipe separation - second"))
        
        self.test("Simple pipes - Wrong answer", 
                 lambda: self.test_answer_comparison(
                     "пожалуйста", 
                     "спасибо|благодарю", 
                     False,
                     "Simple pipe separation - wrong"))
        
        # Test 3a: Example 2 from docs - coche → машина|автомобиль
        self.test("Doc Example 2 - First car synonym", 
                 lambda: self.test_answer_comparison(
                     "машина", 
                     "машина|автомобиль", 
                     True,
                     "Car synonyms - first"))
        
        self.test("Doc Example 2 - Second car synonym", 
                 lambda: self.test_answer_comparison(
                     "автомобиль", 
                     "машина|автомобиль", 
                     True,
                     "Car synonyms - second"))
        
        self.test("Doc Example 2 - Both synonyms (should fail)", 
                 lambda: self.test_answer_comparison(
                     "машина, автомобиль", 
                     "машина|автомобиль", 
                     False,
                     "Car synonyms - both should be rejected"))
        
        # Test 4: Traditional Comma Separation (no parentheses)
        self.test("Multiple meanings - Complete", 
                 lambda: self.test_answer_comparison(
                     "этаж, квартира", 
                     "этаж, квартира", 
                     True,
                     "Multiple meanings - complete answer"))
        
        self.test("Multiple meanings - Order independent", 
                 lambda: self.test_answer_comparison(
                     "квартира, этаж", 
                     "этаж, квартира", 
                     True,
                     "Multiple meanings - different order"))
        
        self.test("Multiple meanings - Incomplete", 
                 lambda: self.test_answer_comparison(
                     "этаж", 
                     "этаж, квартира", 
                     False,
                     "Multiple meanings - incomplete"))
        
        # Test 4a: Example 1 from docs - carta with 3 meanings
        self.test("Doc Example 1 - Three meanings complete", 
                 lambda: self.test_answer_comparison(
                     "письмо, карта, меню", 
                     "письмо, карта, меню", 
                     True,
                     "Three meanings - complete answer"))
        
        self.test("Doc Example 1 - Three meanings different order", 
                 lambda: self.test_answer_comparison(
                     "меню, письмо, карта", 
                     "письмо, карта, меню", 
                     True,
                     "Three meanings - different order"))
        
        self.test("Doc Example 1 - Three meanings incomplete (1/3)", 
                 lambda: self.test_answer_comparison(
                     "письмо", 
                     "письмо, карта, меню", 
                     False,
                     "Three meanings - incomplete (1/3)"))
        
        self.test("Doc Example 1 - Three meanings incomplete (2/3)", 
                 lambda: self.test_answer_comparison(
                     "письмо, карта", 
                     "письмо, карта, меню", 
                     False,
                     "Three meanings - incomplete (2/3)"))
        
        # Test 4b: Example 5 from docs - tiempo → время, погода
        self.test("Doc Example 5 - Time and weather complete", 
                 lambda: self.test_answer_comparison(
                     "время, погода", 
                     "время, погода", 
                     True,
                     "Time and weather - complete"))
        
        self.test("Doc Example 5 - Time and weather different order", 
                 lambda: self.test_answer_comparison(
                     "погода, время", 
                     "время, погода", 
                     True,
                     "Time and weather - different order"))
        
        self.test("Doc Example 5 - Time only (incomplete)", 
                 lambda: self.test_answer_comparison(
                     "время", 
                     "время, погода", 
                     False,
                     "Time and weather - incomplete"))
        
        # Test 5: Square Bracket Clarifications
        self.test("Square brackets - Main word only", 
                 lambda: self.test_answer_comparison(
                     "один", 
                     "один [неопределенный артикль]", 
                     True,
                     "Square brackets - main word"))
        
        self.test("Square brackets - With clarification", 
                 lambda: self.test_answer_comparison(
                     "один неопределенный артикль", 
                     "один [неопределенный артикль]", 
                     True,
                     "Square brackets - with clarification"))
        
        self.test("Square brackets - Clarification only", 
                 lambda: self.test_answer_comparison(
                     "неопределенный артикль", 
                     "один [неопределенный артикль]", 
                     False,
                     "Square brackets - clarification alone should fail"))
        
        # Test 5a: Example 3 from docs - planta → этаж [здания] (updated format)
        self.test("Doc Example 3 - Building floors main word", 
                 lambda: self.test_answer_comparison(
                     "этаж", 
                     "этаж [здания]", 
                     True,
                     "Building floors - main word only"))
        
        self.test("Doc Example 3 - Building floors with clarification", 
                 lambda: self.test_answer_comparison(
                     "этаж здания", 
                     "этаж [здания]", 
                     True,
                     "Building floors - with clarification"))
        
        self.test("Doc Example 3 - Building floors clarification only", 
                 lambda: self.test_answer_comparison(
                     "здания", 
                     "этаж [здания]", 
                     False,
                     "Building floors - clarification alone should fail"))
        
        # Test 5b: Important error case from Example 4 docs
        self.test("Doc Example 4 - Wrong 3-meaning interpretation", 
                 lambda: self.test_answer_comparison(
                     "равный, одинаковый, сейчас", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     False,
                     "Should reject treating grouping as 3 separate meanings"))
        
        # Test 6: Complex Combined Cases
        self.test("Complex - Grouping with brackets", 
                 lambda: self.test_answer_comparison(
                     "на горизонтальной поверхности", 
                     "на [горизонтальной поверхности]", 
                     True,
                     "Should handle brackets in grouped context"))
        
        # Test 7: Edge Cases
        self.test("Edge case - Empty spaces", 
                 lambda: self.test_answer_comparison(
                     " равный , сейчас ", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Should handle extra spaces"))
        
        self.test("Edge case - Case insensitive", 
                 lambda: self.test_answer_comparison(
                     "РАВНЫЙ, СЕЙЧАС", 
                     "(равный|одинаковый), (сейчас|сразу)", 
                     True,
                     "Should be case insensitive"))
        
        # Test 7b: Important clarification test - pipes work correctly
        # The docs say "NOT время|погода because these are different meanings"
        # But IF someone did use время|погода format, our system should handle pipes correctly
        self.test("Clarification - Pipes work correctly even for different concepts", 
                 lambda: self.test_answer_comparison(
                     "время", 
                     "время|погода", 
                     True,
                     "Pipes work correctly - accepts either alternative"))
        
        self.test("Clarification - Pipes work correctly (second alternative)", 
                 lambda: self.test_answer_comparison(
                     "погода", 
                     "время|погода", 
                     True,
                     "Pipes work correctly - accepts second alternative"))
        
        # The correct format for time/weather should be: время, погода (comma)
        
        # Test 8: Multiple pipe alternatives (should work)
        self.test("Multiple pipes - First of three", 
                 lambda: self.test_answer_comparison(
                     "bonito", 
                     "bonito|hermoso|lindo", 
                     True,
                     "Multiple pipes - first alternative"))
        
        self.test("Multiple pipes - Middle of three", 
                 lambda: self.test_answer_comparison(
                     "hermoso", 
                     "bonito|hermoso|lindo", 
                     True,
                     "Multiple pipes - middle alternative"))
        
        self.test("Multiple pipes - Last of three", 
                 lambda: self.test_answer_comparison(
                     "lindo", 
                     "bonito|hermoso|lindo", 
                     True,
                     "Multiple pipes - last alternative"))
        
        # Test 9: Display Text Tests
        self.test("Display text - Grouping", 
                 lambda: self.test_display_text(
                     "(равный|одинаковый), (сейчас|сразу)",
                     "равный, сейчас",
                     "Should show first alternatives from each group"))
        
        self.test("Display text - Simple pipes", 
                 lambda: self.test_display_text(
                     "спасибо|благодарю",
                     "спасибо",
                     "Should show first alternative only"))
        
        self.test("Display text - Multiple pipes", 
                 lambda: self.test_display_text(
                     "bonito|hermoso|lindo",
                     "bonito",
                     "Should show first of multiple alternatives"))
        
        # Summary
        print(f"\n{YELLOW}Answer Comparison Test Summary:{RESET}")
        print(f"  {GREEN}Passed: {self.passed}{RESET}")
        if self.failed > 0:
            print(f"  {RED}Failed: {self.failed}{RESET}")
        print()
        
        return self.failed == 0
    
    def test_display_text(self, correct_answer, expected_display, description=""):
        """Test display text cleaning"""
        try:
            r = requests.post(f"{API_URL}/test/answer-comparison", 
                            json={
                                'userAnswer': 'dummy',  # Not used for display test
                                'correctAnswer': correct_answer
                            }, 
                            timeout=TIMEOUT)
            
            if r.status_code == 403:
                print(f"{YELLOW}⚠{RESET} Test endpoint blocked (production mode)")
                return
            
            self.assert_equal(r.status_code, 200, f"API call failed for: {description}")
            data = r.json()
            
            actual_display = data['result']['displayText']
            self.assert_equal(actual_display, expected_display, 
                            f"Display text failed for: {description}\n"
                            f"Correct answer: '{correct_answer}'\n"
                            f"Expected display: '{expected_display}'\n"
                            f"Actual display: '{actual_display}'")
                
        except requests.exceptions.RequestException as e:
            raise AssertionError(f"API request failed: {e}")

def main():
    """Main test runner"""
    global API_URL
    
    if len(sys.argv) > 1 and sys.argv[1] == '--help':
        print(f"Usage: {sys.argv[0]} [API_URL]")
        print(f"Default API_URL: {API_URL}")
        sys.exit(0)
    
    if len(sys.argv) > 1:
        API_URL = sys.argv[1]
        if not API_URL.endswith('/api'):
            API_URL += '/api'
    
    print(f"Testing against: {API_URL}")
    
    runner = AnswerComparisonTestRunner()
    success = runner.run_all_tests()
    
    sys.exit(0 if success else 1)

if __name__ == '__main__':
    main()