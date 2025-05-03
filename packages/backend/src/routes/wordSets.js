const express = require('express');
const { body, query } = require('express-validator');

const { STATUS, logger } = require('../config');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { wordSetsService } = require('../services');
const { ValidationError } = require('../utils/errors');
const { sanitizeInput } = require('../utils/helpers');

const router = express.Router();

// GET /word-sets/user - Get a user's word sets
router.get(
  '/user',
  authenticateToken,
  [
    query('wordListName')
      .isString()
      .trim()
      .notEmpty()
      .withMessage('wordListName query parameter is required'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { userId } = req;
      const sanitizedQuery = sanitizeInput(req.query);
      const { wordListName } = sanitizedQuery;

      const wordSets = await wordSetsService.getUserWordSets(userId, wordListName);

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
    body('status')
      .isString()
      .trim()
      .isIn(Object.values(STATUS))
      .withMessage('Invalid status value'),
    body('wordPairIds').isArray({ min: 0 }).withMessage('wordPairIds must be an array'),
    body('wordPairIds.*')
      .isInt({ min: 1 })
      .withMessage('Each wordPairId must be a positive integer'),
  ],
  validateRequest,
  async (req, res, next) => {
    try {
      const { userId } = req;
      const sanitizedInput = sanitizeInput(req.body);
      const { status, wordPairIds } = sanitizedInput;

      const result = await wordSetsService.updateUserWordSetStatus(userId, wordPairIds, status);

      logger.info('User word sets status updated successfully', {
        userId,
        status,
        count: wordPairIds.length,
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
    const wordLists = await wordSetsService.getWordLists();

    logger.info('Word lists retrieved successfully');
    res.status(200).json(wordLists);
  } catch (error) {
    next(error);
  }
});

// GET /word-sets/:id - Get a specific word set by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
  try {
    const wordSetId = Number.parseInt(req.params.id, 10);

    if (isNaN(wordSetId) || wordSetId <= 0) {
      return next(new ValidationError('Invalid word set ID'));
    }

    const wordSet = await wordSetsService.getWordSetById(wordSetId);

    logger.info('Word set retrieved successfully', { wordSetId });
    res.status(200).json(wordSet);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
