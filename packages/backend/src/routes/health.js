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
const express = require('express');

const { healthService } = require('../services');

const router = express.Router();

// GET /health - Health check endpoint
router.get('/', async (req, res, next) => {
  try {
    const healthStatus = await healthService.checkHealth();
    res.status(200).json(healthStatus);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
