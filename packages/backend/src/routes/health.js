/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/routes/health.js
 */

import { Router } from 'express';

import checkHealth from '../services/health.js';

const router = Router();
// GET /health - Health check endpoint
router.get('/', async (req, res, next) => {
  try {
    const healthStatus = await checkHealth();
    return res.status(200).json(healthStatus);
  } catch (error) {
    return next(error);
  }
});
export default router;
