/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/routes/index.js
 */

import { Router } from 'express';

import { logger } from '../config/index.js';
import { NotFoundError } from '../utils/errors.js';

import authRoutes from './auth.js';
import healthRoutes from './health.js';
import wordSetsRoutes from './wordSets.js';

const router = Router();

// Log all requests for debugging
router.use((req, res, next) => {
  logger.debug(`Request URL: ${req.url}, Method: ${req.method}, Path: ${req.path}, BaseUrl: ${req.baseUrl}`);
  next();
});

// Apply routes
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/word-sets', wordSetsRoutes);

// Handle 404 for API routes
router.all('*', (req, res, next) => {
  logger.debug(`404 Handler: Cannot ${req.method} ${req.path}`);
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
});
export default router;
