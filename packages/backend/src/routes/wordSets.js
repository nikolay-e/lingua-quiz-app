/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/routes/wordSets.js
 */

import { Router } from 'express';
import { body, query } from 'express-validator';

import { logger, STATUS } from '../config/index.js';
import { authenticateToken, validateRequest } from '../middleware/index.js';
import * as wordSetsService from '../services/wordSets.js';
import { ValidationError } from '../utils/errors.js';
import { trimInput } from '../utils/helpers.js';

const router = Router();
// GET /word-sets/user - Get a user's word sets
router.get(
  '/user',
  authenticateToken,
  [query('wordListName').isString().trim().notEmpty().withMessage('wordListName query parameter is required')],
  validateRequest,
  async (req, res, next) => {
    try {
      const { userId } = req;
      const sanitizedQuery = trimInput(req.query);
      const { wordListName } = sanitizedQuery;
      const wordSets = await wordSetsService.fetchUserWordSets(userId, wordListName);
      logger.info('User word sets retrieved successfully', { userId, wordListName });
      res.status(200).json(wordSets);
    } catch (error) {
      next(error);
    }
  }
);
// POST /word-sets/user - Update a user's word set status
router.post(
  '/user',
  authenticateToken,
  [
    body('status').isString().trim().isIn(Object.values(STATUS)).withMessage('Invalid status value'),
    body('wordPairIds').isArray({ min: 0 }).withMessage('wordPairIds must be an array'),
    body('wordPairIds.*').isInt({ min: 1 }).withMessage('Each wordPairId must be a positive integer'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { userId } = req;
      const sanitizedInput = trimInput(req.body);
      const { status, wordPairIds } = sanitizedInput;
      const result = await wordSetsService.updateWordSetStatusForUser(userId, wordPairIds, status);
      logger.info('User word sets status updated successfully', {
        count: wordPairIds.length,
        status,
        userId,
      });
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }
);
// GET /word-sets - Get all word lists
router.get('/', authenticateToken, async (req, res, next) => {
  try {
    const wordLists = await wordSetsService.fetchWordLists();
    logger.info('Word lists retrieved successfully');
    return res.status(200).json(wordLists);
  } catch (error) {
    return next(error);
  }
});
// GET /word-sets/:id - Get a specific word set by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const wordSetId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(wordSetId) || wordSetId <= 0) {
      return next(new ValidationError('Invalid word set ID'));
    }
    const wordSet = await wordSetsService.fetchWordSetById(wordSetId);
    logger.info('Word set retrieved successfully', { wordSetId });
    return res.status(200).json(wordSet);
  } catch (error) {
    return next(error);
  }
});
export default router;
