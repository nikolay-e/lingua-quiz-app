// Use bcryptjs (pure JS implementation) in test environment to avoid binary compatibility issues
const bcrypt = process.env.NODE_ENV === 'test' ? require('bcryptjs') : require('bcrypt');
const { pool } = require('./connection');
const { ENV } = require('../config');
const { DatabaseError, NotFoundError } = require('../utils/errors');
const { convertKeysToCamelCase } = require('../utils/helpers');

/**
 * Checks if a user with the given email exists
 * @param {string} email - The email to check
 * @returns {Promise<boolean>} - True if the user exists, false otherwise
 */
async function userExists(email) {
  try {
    const result = await pool.query('SELECT 1 FROM "user" WHERE email = $1 LIMIT 1', [email]);
    return result.rows.length > 0;
  } catch (error) {
    throw new DatabaseError('Error checking user existence', error);
  }
}

/**
 * Creates a new user
 * @param {string} email - The user's email
 * @param {string} password - The user's password
 * @returns {Promise<void>}
 */
async function createUser(email, password) {
  try {
    const hashedPassword = await bcrypt.hash(password, ENV.BCRYPT_SALT_ROUNDS);
    await pool.query('INSERT INTO "user" (email, password) VALUES ($1, $2)', [
      email,
      hashedPassword,
    ]);
  } catch (error) {
    throw new DatabaseError('Error creating user', error);
  }
}

/**
 * Gets a user by email
 * @param {string} email - The email to look up
 * @returns {Promise<Object>} - The user object
 */
async function getUserByEmail(email) {
  try {
    const result = await pool.query('SELECT id, email, password FROM "user" WHERE email = $1', [
      email,
    ]);

    const users = convertKeysToCamelCase(result.rows);
    if (users.length === 0) {
      return null;
    }

    return users[0];
  } catch (error) {
    throw new DatabaseError('Error getting user by email', error);
  }
}

/**
 * Deletes a user by ID
 * @param {number} userId - The ID of the user to delete
 * @returns {Promise<Object>} - The deleted user's email
 */
async function deleteUser(userId) {
  try {
    const result = await pool.query('DELETE FROM "user" WHERE id = $1 RETURNING email', [userId]);

    if (result.rowCount === 0) {
      throw new NotFoundError('User not found');
    }

    return { email: result.rows[0].email };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Error deleting user', error);
  }
}

/**
 * Validates a user's password
 * @param {string} password - The plain text password
 * @param {string} hashedPassword - The hashed password
 * @returns {Promise<boolean>} - True if the password is valid, false otherwise
 */
async function validatePassword(password, hashedPassword) {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    throw new DatabaseError('Error validating password', error);
  }
}

module.exports = {
  userExists,
  createUser,
  getUserByEmail,
  deleteUser,
  validatePassword,
};
