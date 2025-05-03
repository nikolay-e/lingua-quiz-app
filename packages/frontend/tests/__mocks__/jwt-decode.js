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

/**
 * Mock implementation of jwt-decode module
 * This is needed because jwt-decode v4.0.0+ uses ES modules
 */

// Create a mock function that parses JWT tokens like the real jwt-decode would
const jwtDecode = jest.fn((token) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token specified');
  }

  try {
    // Split the token into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid token format');
    }

    // Base64 decode the payload (middle part)
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch (error) {
    throw new Error('Error decoding token: ' + error.message);
  }
});

// Export as ES module default export
export default jwtDecode;
