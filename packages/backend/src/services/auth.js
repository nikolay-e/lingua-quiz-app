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
const jwt = require('jsonwebtoken');

const { ENV } = require('../config');
const db = require('../db');
const { AuthenticationError, ConflictError, NotFoundError } = require('../utils/errors');

/**
 * Registers a new user
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<{ message: string }>}
 */
async function registerUser(email, password) {
  // Check if user already exists
  if (await db.userExists(email)) {
    throw new ConflictError('User already exists');
  }

  // Create the new user
  await db.createUser(email, password);

  return { message: 'User registered successfully' };
}

/**
 * Logs in a user
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<{ token: string, expiresIn: string }>}
 */
async function loginUser(email, password) {
  // Get user by email
  const user = await db.getUserByEmail(email);

  if (!user) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Validate password
  const validPassword = await db.validatePassword(password, user.password);
  if (!validPassword) {
    throw new AuthenticationError('Invalid credentials');
  }

  // Generate JWT token
  const token = jwt.sign({ userId: user.id }, ENV.JWT_SECRET, {
    expiresIn: ENV.JWT_EXPIRES_IN,
  });

  return { token, expiresIn: ENV.JWT_EXPIRES_IN };
}

/**
 * Deletes a user account
 * @param {number} userId - The ID of the user to delete
 * @returns {Promise<{ message: string }>}
 */
async function deleteUserAccount(userId) {
  try {
    const result = await db.deleteUser(userId);
    return {
      message: 'Account deleted successfully',
      email: result.email,
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw error;
  }
}

module.exports = {
  registerUser,
  loginUser,
  deleteUserAccount,
};
