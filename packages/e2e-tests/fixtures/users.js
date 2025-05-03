// packages/e2e-tests/fixtures/users.js
import { AUTH_CONSTANTS } from '../utils/constants';

/**
 * Creates a unique test user
 * @param {string} prefix - Optional prefix for email
 * @returns {Object} User object with email and password
 */
function createTestUser(prefix = 'testuser') {
  const timestamp = Date.now();
  const safePrefix = prefix.replaceAll(/[^\w-]/g, '_');

  return {
    email: `${safePrefix}_${timestamp}@example.com`,
    password: AUTH_CONSTANTS.DEFAULT_PASSWORD,
    isRegistered: false,
  };
}

/**
 * Creates a test user specifically for a quiz
 * @param {string} quizName - Quiz name
 * @returns {Object} User object with email and password
 */
function createQuizUser(quizName) {
  const safeQuizName = quizName ? quizName.replaceAll(/[^\w-]/g, '_') : 'default';
  return createTestUser(`quizuser_${safeQuizName}`);
}

export default {
  createTestUser,
  createQuizUser,
};
