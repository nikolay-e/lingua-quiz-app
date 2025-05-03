/*
 * LinguaQuiz – Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  – Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  – Commercial License v2              →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 */

// packages/frontend/tests/component/quiz.test.js

import {
  serverAddress,
  errorHandler,
  createTestUser,
  deleteTestUser,
} from '../__mocks__/componentTestSetup.js';

/**
 * Component tests for quiz functionality using real API
 *
 * These tests interact with a real backend running in Docker
 * to verify quiz functionality works correctly
 */

// Always run these tests (assuming Docker is already running)
const runTest = describe;

runTest('Quiz Flow with Real API', () => {
  // Test data
  const testUser = {
    email: `quiz_test_${Date.now()}@example.com`,
    password: 'TestPassword123!',
  };

  let authToken;

  // Setup before all tests
  beforeAll(async () => {
    // Create test user and get auth token
    authToken = await createTestUser(testUser);
  }, 15_000);

  // Cleanup after all tests
  afterAll(async () => {
    // Delete test user if created
    if (authToken) {
      await deleteTestUser(authToken);
    }

    // Clear localStorage
    localStorage.clear();
  }, 10_000);

  beforeEach(() => {
    // Skip test if no auth token
    if (!authToken) {
      console.warn('Skipping test - no auth token available');
      return;
    }

    // Setup DOM for quiz testing
    document.body.innerHTML = `
      <div id="app-container">
        <div id="quiz-container">
          <div id="word-display"></div>
          <div id="quiz-options-container"></div>
          <div id="feedback-container"></div>
          <div id="error-container"></div>
          <div id="loader" style="display: none;"></div>
          <div id="quiz-controls">
            <button id="quiz-next-btn">Next</button>
          </div>
        </div>
        <div id="word-sets-container"></div>
      </div>
    `;

    // Spy on error handler methods
    jest.spyOn(errorHandler, 'showError');
    jest.spyOn(errorHandler, 'handleApiError');
  });

  afterEach(() => {
    // Clear mocks
    jest.clearAllMocks();
  });

  // Test fetching available word sets
  test('should fetch available word sets', async () => {
    // Skip if no auth token
    if (!authToken) {
      return;
    }

    // Make API request to get word sets
    const response = await fetch(`${serverAddress}/api/word-sets`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Check response is successful
    expect(response.ok).toBe(true);

    // Parse response data
    const wordSets = await response.json();

    // Check we got word sets array
    expect(Array.isArray(wordSets)).toBe(true);

    // There should be at least one word set
    expect(wordSets.length).toBeGreaterThan(0);

    // Each word set should have an id and name
    for (const set of wordSets) {
      expect(set).toHaveProperty('id');
      expect(set).toHaveProperty('name');
    }
  }, 10_000);

  // Test getting quiz words for a specific set
  test('should get quiz words for a specific set', async () => {
    // Skip if no auth token
    if (!authToken) {
      return;
    }

    // First get available word sets
    const setsResponse = await fetch(`${serverAddress}/api/word-sets`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const wordSets = await setsResponse.json();

    // Skip if no word sets available
    if (wordSets.length === 0) {
      console.warn('Skipping test - no word sets available');
      return;
    }

    // Get the first word set
    const firstSet = wordSets[0];

    // Get quiz words for this set
    const quizResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    // Check response is successful
    expect(quizResponse.ok).toBe(true);

    // Parse response data
    const quizData = await quizResponse.json();

    // Check quiz data structure
    expect(quizData).toHaveProperty('currentWord');
    expect(quizData).toHaveProperty('options');
    expect(Array.isArray(quizData.options)).toBe(true);

    // Should have multiple options
    expect(quizData.options.length).toBeGreaterThan(1);
  }, 10_000);

  // Test submitting an answer
  test('should submit an answer and get feedback', async () => {
    // Skip if no auth token
    if (!authToken) {
      return;
    }

    // First get available word sets
    const setsResponse = await fetch(`${serverAddress}/api/word-sets`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const wordSets = await setsResponse.json();

    // Get the first word set
    const firstSet = wordSets[0];

    // Get quiz words for this set
    const quizResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });

    const quizData = await quizResponse.json();
    const { currentWord, options } = quizData;

    // Choose the first option as our answer (correct or not doesn't matter)
    const answer = options[0].id;

    // Submit the answer
    const submitResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}/answer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wordId: currentWord.id,
        answerId: answer,
      }),
    });

    // Check response is successful
    expect(submitResponse.ok).toBe(true);

    // Parse response data
    const feedback = await submitResponse.json();

    // Check feedback structure
    expect(feedback).toHaveProperty('correct');
    expect(typeof feedback.correct).toBe('boolean');

    // For correct answers, should have mastery info
    if (feedback.correct) {
      expect(feedback).toHaveProperty('mastery');
    }

    // Should have correctAnswer info
    expect(feedback).toHaveProperty('correctAnswer');
  }, 15_000);
});
