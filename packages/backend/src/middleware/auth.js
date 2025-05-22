/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/middleware/auth.js
 */

import jsonwebtoken from 'jsonwebtoken';

import { ENV, logger } from '../config/index.js';
import { AuthenticationError, AuthorizationError } from '../utils/errors.js';

const { verify } = jsonwebtoken;

function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') && authHeader.split(' ')[1];
    if (!token) {
      throw new AuthenticationError('No token provided');
    }
    try {
      // Verify with explicit algorithm and options
      const decoded = verify(token, ENV.JWT_SECRET, {
        algorithms: ['HS256'], // Only accept tokens signed with HS256
        complete: true, // Return full decoded token (header, payload, signature)
      });

      // Extract claims from the payload
      const { payload } = decoded;

      // Validate essential claims
      if (!payload.userId) {
        throw new Error('Token missing required userId claim');
      }

      if (!payload.iat) {
        logger.warn('Token missing iat claim - may be from old system');
      }

      // Set user ID for the request
      req.userId = payload.userId;
      req.userEmail = payload.sub; // Optional - available if token has subject claim

      logger.debug(`Token authenticated for userId: ${req.userId}`);
      next();
    } catch (error) {
      logger.warn('Invalid token received', { error: error.message });
      throw new AuthorizationError('Invalid or expired token');
    }
  } catch (error) {
    next(error);
  }
}
export default authenticateToken;
