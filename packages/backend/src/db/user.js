/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/db/user.js
 */

import bcrypt from 'bcrypt';

import { ConflictError, DatabaseError, NotFoundError } from '../utils/errors.js';
import { convertKeysToCamelCase } from '../utils/helpers.js';

import { pool } from './connection.js';

const { compare, hash } = bcrypt;

async function validatePassword(password, hashedPassword) {
  try {
    return await compare(password, hashedPassword);
  } catch (error) {
    throw new DatabaseError('Error validating password', error);
  }
}

async function createUser(userData) {
  const { email, password } = userData;
  try {
    const saltRounds = 10; // Default if not specified in ENV
    const hashedPassword = await hash(password, saltRounds);

    const result = await pool.query('INSERT INTO "user" (email, password) VALUES ($1, $2) RETURNING id, email', [email, hashedPassword]);

    return convertKeysToCamelCase(result.rows[0]);
  } catch (error) {
    if (error.code === '23505') {
      // Unique violation
      throw new ConflictError('User already exists');
    }
    throw new DatabaseError('Error creating user', error);
  }
}

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

async function getUserByEmail(email) {
  try {
    const result = await pool.query('SELECT id, email, password FROM "user" WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return null;
    }

    return convertKeysToCamelCase(result.rows[0]);
  } catch (error) {
    throw new DatabaseError('Error getting user by email', error);
  }
}

async function userExists(email) {
  try {
    const result = await pool.query('SELECT EXISTS(SELECT 1 FROM "user" WHERE email = $1)', [email]);
    return result.rows[0].exists;
  } catch (error) {
    throw new DatabaseError('Error checking if user exists', error);
  }
}

export { createUser, deleteUser, getUserByEmail, userExists, validatePassword };
