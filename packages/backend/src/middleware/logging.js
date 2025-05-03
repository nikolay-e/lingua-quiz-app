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
const { logger } = require('../config');

/**
 * Middleware to log incoming requests
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function requestLogger(req, res, next) {
  logger.info(`Incoming request: ${req.method} ${req.originalUrl || req.url} from ${req.ip}`);
  next();
}

/**
 * Middleware to log outgoing responses
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
function responseLogger(req, res, next) {
  const oldSend = res.send;
  res.send = function send(...args) {
    res.on('finish', () => {
      logger.info(
        `Response status: ${res.statusCode} for ${req.method} ${req.originalUrl || req.url}`
      );
    });
    oldSend.apply(res, args);
  };
  next();
}

module.exports = {
  requestLogger,
  responseLogger,
};
