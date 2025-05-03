const express = require('express');
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');

const { logger } = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { authService } = require('../services');
const { sanitizeInput } = require('../utils/helpers');

const router = express.Router();

// Add stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Increased from 10 to 100 for e2e testing
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many authentication attempts, please try again later',
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
      .withMessage(
        'Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character'
      ),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const sanitizedInput = sanitizeInput(req.body);
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
  [
    body('email').isEmail().normalizeEmail().withMessage('Invalid email format'),
    body('password').notEmpty().withMessage('Password cannot be empty'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const sanitizedInput = sanitizeInput(req.body);
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
      userId,
      email: result.email,
    });

    res.status(200).json({ message: result.message });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
