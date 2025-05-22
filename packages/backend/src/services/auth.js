/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/services/auth.js
 */

import jsonwebtoken from 'jsonwebtoken';

import { ENV } from '../config/index.js';
import { createUser, deleteUser, getUserByEmail, userExists, validatePassword } from '../db/index.js';
import { AuthenticationError, ConflictError, DatabaseError, NotFoundError } from '../utils/errors.js';

const { sign } = jsonwebtoken;

async function deleteUserAccount(userId) {
  try {
    const result = await deleteUser(userId);
    return {
      email: result.email,
      message: 'Account deleted successfully',
    };
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw error;
  }
}

async function loginUser(email, password) {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      throw new AuthenticationError('Invalid credentials');
    }

    const validPassword = await validatePassword(password, user.password);
    if (!validPassword) {
      throw new AuthenticationError('Invalid credentials');
    }

    const jwtExpiresIn = ENV.JWT_EXPIRES_IN || '1h';
    const token = sign(
      {
        userId: user.id,
        // Add issued at and subject claims for better security
        iat: Math.floor(Date.now() / 1000),
        sub: user.email,
      },
      ENV.JWT_SECRET,
      {
        expiresIn: jwtExpiresIn,
        algorithm: 'HS256', // Explicitly specify algorithm
      }
    );

    return {
      expiresIn: jwtExpiresIn,
      token,
      user: { email: user.email, id: user.id },
    };
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    throw new DatabaseError('Login failed', error);
  }
}

async function registerUser(email, password) {
  try {
    const existingUser = await userExists(email);
    if (existingUser) {
      throw new ConflictError('User already exists');
    }

    const userData = {
      email,
      password,
    };
    const newUser = await createUser(userData);

    const jwtExpiresIn = ENV.JWT_EXPIRES_IN || '1h';
    const token = sign(
      {
        userId: newUser.id,
        // Add issued at and subject claims for better security
        iat: Math.floor(Date.now() / 1000),
        sub: newUser.email,
      },
      ENV.JWT_SECRET,
      {
        expiresIn: jwtExpiresIn,
        algorithm: 'HS256', // Explicitly specify algorithm
      }
    );

    return {
      expiresIn: jwtExpiresIn,
      token,
      user: { email: newUser.email, id: newUser.id },
    };
  } catch (error) {
    if (error instanceof ConflictError) {
      throw error;
    }
    throw new DatabaseError('Registration failed', error);
  }
}

export { deleteUserAccount, loginUser, registerUser };
