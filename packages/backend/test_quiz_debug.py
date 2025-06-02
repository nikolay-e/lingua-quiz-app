#!/usr/bin/env python3
"""Debug quiz issues"""

import requests
import json

API_URL = 'http://localhost:9000/api'

# Register and login
username = 'debug_user_123'
password = 'TestPassword123!'

print("1. Registering user...")
r = requests.post(f"{API_URL}/auth/register", 
                 json={'username': username, 'password': password})
if r.status_code != 201:
    print(f"Registration failed: {r.status_code} {r.text}")
    exit(1)

token = r.json()['token']
headers = {'Authorization': f'Bearer {token}'}

print("2. Starting quiz...")
r = requests.post(f"{API_URL}/quiz/start",
                 json={'wordListName': 'German Russian A1'},
                 headers=headers)
if r.status_code != 200:
    print(f"Start quiz failed: {r.status_code} {r.text}")
    exit(1)

session_data = r.json()
print(f"Session started. Word counts: L0={len(session_data['wordLists']['level0'])}, L1={len(session_data['wordLists']['level1'])}")

print("\n3. Getting first question...")
r = requests.get(f"{API_URL}/quiz/next-question",
                params={'wordListName': 'German Russian A1'},
                headers=headers)
if r.status_code != 200:
    print(f"Get question failed: {r.status_code} {r.text}")
    exit(1)

question = r.json()
print(f"Question: {json.dumps(question, indent=2)}")

# Find correct answer
translation_id = question['translationId']
direction = question['direction']
word = question['word']

correct_answer = None
for level in ['level0', 'level1', 'level2', 'level3']:
    for word_pair in session_data['wordLists'][level]:
        if word_pair.get('id') == translation_id:
            if direction == 'normal':
                if word_pair.get('source') == word:
                    correct_answer = word_pair.get('target')
            else:
                if word_pair.get('target') == word:
                    correct_answer = word_pair.get('source')
            break
    if correct_answer:
        break

print(f"\n4. Correct answer found: {correct_answer}")

if not correct_answer:
    print("ERROR: Could not find correct answer!")
    print(f"Looking for translation_id={translation_id}, word='{word}', direction={direction}")
    
    # Debug: print all words
    print("\nAll words in session:")
    for level in ['level0', 'level1', 'level2', 'level3']:
        if session_data['wordLists'][level]:
            print(f"\n{level}:")
            for wp in session_data['wordLists'][level][:5]:  # First 5
                print(f"  id={wp.get('id')}, source='{wp.get('source')}', target='{wp.get('target')}'")

print("\n5. Submitting answer...")
r = requests.post(f"{API_URL}/quiz/submit-answer",
                 json={
                     'wordListName': 'German Russian A1',
                     'translationId': translation_id,
                     'answer': correct_answer or 'test',
                     'displayedWord': word
                 },
                 headers=headers)

if r.status_code != 200:
    print(f"Submit answer failed: {r.status_code} {r.text}")
else:
    result = r.json()
    print(f"Result: {json.dumps(result, indent=2)}")

# Cleanup
r = requests.delete(f"{API_URL}/auth/delete-account", headers=headers)
print(f"\nCleanup: {'Success' if r.status_code == 200 else 'Failed'}")