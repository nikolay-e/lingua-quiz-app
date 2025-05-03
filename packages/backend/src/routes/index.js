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

const authRoutes = require('./auth');
const healthRoutes = require('./health');
const wordSetsRoutes = require('./wordSets');
const { NotFoundError } = require('../utils/errors');

const router = express.Router();

// Apply routes
router.use('/auth', authRoutes);
router.use('/health', healthRoutes);
router.use('/word-sets', wordSetsRoutes);

// For backward compatibility with existing API clients
router.use('/healthz', healthRoutes);
router.use('/register', (req, res) => res.redirect(307, '/auth/register'));
router.use('/login', (req, res) => res.redirect(307, '/auth/login'));
router.use('/delete-account', (req, res) => res.redirect(307, '/auth/delete-account'));
router.use('/user/word-sets', (req, res) => res.redirect(307, '/word-sets/user'));
router.use('/word-lists', (req, res) => res.redirect(307, '/word-sets'));

// Log all requests for debugging
router.use((req, res, next) => {
  console.log(
    `DEBUG - Request URL: ${req.url}, Method: ${req.method}, Path: ${req.path}, BaseUrl: ${req.baseUrl}`
  );
  next();
});

// Handle 404 for API routes
router.all('*', (req, res, next) => {
  console.log(`DEBUG - 404 Handler: Cannot ${req.method} ${req.path}`);
  next(new NotFoundError(`Cannot ${req.method} ${req.path}`));
});

module.exports = router;
