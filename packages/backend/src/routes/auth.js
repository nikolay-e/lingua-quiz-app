/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/routes/auth.js
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { body } from 'express-validator';

import { logger } from '../config/index.js';
import { authenticateToken, validateRequest } from '../middleware/index.js';
import * as authService from '../services/auth.js';
import { trimInput } from '../utils/helpers.js';

const router = Router();
// Add stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  legacyHeaders: false,
  // 15 minutes
  max: 100,
  message: 'Too many authentication attempts, please try again later',
  // Increased from 10 to 100 for e2e testing
  standardHeaders: true,
  windowMs: 15 * 60 * 1000,
});
// POST /auth/register - Register a new user
router.post(
  '/register',
  authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[^\dA-Za-z]).{8,}$/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const sanitizedInput = trimInput(req.body);
      const { email, password } = sanitizedInput;
      const result = await authService.registerUser(email, password);
      logger.info('User registered successfully', { email });
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  }
);
// POST /auth/login - Login a user
router.post(
  '/login',
  authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Invalid email format'), body('password').notEmpty().withMessage('Password cannot be empty')],
  validateRequest,
  async (req, res, next) => {
    try {
      const sanitizedInput = trimInput(req.body);
      const { email, password } = sanitizedInput;
      const result = await authService.loginUser(email, password);
      logger.info('User logged in successfully', { email });
      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);
// DELETE /auth/delete-account - Delete user account
router.delete('/delete-account', authenticateToken, async (req, res, next) => {
  const { userId } = req;
  try {
    const result = await authService.deleteUserAccount(userId);
    logger.info('User account deleted successfully', {
      email: result.email,
      userId,
    });
    res.status(200).json({ message: result.message });
  } catch (error) {
    next(error);
  }
});
export default router;
