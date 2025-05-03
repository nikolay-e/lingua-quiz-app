// packages/frontend/tests/e2e-jest/quiz-real-api.test.js

import { AuthUtils } from '../../src/js/utils/authUtils.js';
import { errorHandler } from '../../src/js/utils/errorHandler.js';
import serverAddress from '../../src/js/config.js';

// Flag to determine if we're running with Docker
const USING_REAL_API = process.env.USE_REAL_API === 'true';

/**
 * End-to-end tests for quiz functionality using Jest with real API
 * 
 * These tests simulate browser interactions using JSDOM
 * but make real API calls to the backend running in Docker
 * 
 * Run with:
 * npm run test:frontend:e2e-jest
 */

// Only run these tests when explicitly enabled
const runTest = USING_REAL_API ? describe : describe.skip;

runTest('Quiz Flow with Real API', () => {
  // Test data
  const testUser = {
    email: `quiz_test_${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };
  
  let authToken;
  
  // Setup before all tests
  beforeAll(async () => {
    // Create a test user and get auth token
    try {
      // Register user
      await fetch(`${serverAddress}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });
      
      // Login to get token
      const loginResponse = await fetch(`${serverAddress}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testUser)
      });
      
      const loginData = await loginResponse.json();
      authToken = loginData.token;
      
      // Store in localStorage for auth
      localStorage.setItem('token', authToken);
      localStorage.setItem('email', testUser.email);
      
    } catch (err) {
      console.error('Failed to create test user:', err);
    }
  }, 15000);
  
  // Cleanup after all tests
  afterAll(async () => {
    // Delete test user if created
    if (authToken) {
      try {
        await fetch(`${serverAddress}/api/auth/delete-account`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` }
        });
      } catch (err) {
        console.error('Failed to delete test user:', err);
      }
    }
    
    // Clear localStorage
    localStorage.clear();
  }, 10000);
  
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
    
    // Import and use node-fetch directly for testing
    import('node-fetch').then(({ default: nodeFetch }) => {
      global.fetch = jest.fn().mockImplementation(async (url, options = {}) => {
        // Log fetch requests
        console.log('Fetch request:', url, options?.method || 'GET');
        
        try {
          // Use node-fetch implementation
          const response = await nodeFetch(url, options);
          console.log('Fetch response status:', response.status);
          return response;
        } catch (error) {
          console.error('Fetch error:', error);
          throw error;
        }
      });
    });
    
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
      headers: { 'Authorization': `Bearer ${authToken}` }
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
  }, 10000);
  
  // Test getting quiz words for a specific set
  test('should get quiz words for a specific set', async () => {
    // Skip if no auth token
    if (!authToken) {
      return;
    }
    
    // First get available word sets
    const setsResponse = await fetch(`${serverAddress}/api/word-sets`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const wordSets = await setsResponse.json();
    
    // Skip if no word sets available
    if (!wordSets.length) {
      console.warn('Skipping test - no word sets available');
      return;
    }
    
    // Get the first word set
    const firstSet = wordSets[0];
    
    // Get quiz words for this set
    const quizResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
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
  }, 10000);
  
  // Test submitting an answer
  test('should submit an answer and get feedback', async () => {
    // Skip if no auth token
    if (!authToken) {
      return;
    }
    
    // First get available word sets
    const setsResponse = await fetch(`${serverAddress}/api/word-sets`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const wordSets = await setsResponse.json();
    
    // Get the first word set
    const firstSet = wordSets[0];
    
    // Get quiz words for this set
    const quizResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    
    const quizData = await quizResponse.json();
    const { currentWord, options } = quizData;
    
    // Choose the first option as our answer (correct or not doesn't matter)
    const answer = options[0].id;
    
    // Submit the answer
    const submitResponse = await fetch(`${serverAddress}/api/quiz/${firstSet.id}/answer`, {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wordId: currentWord.id,
        answerId: answer
      })
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
  }, 15000);
});