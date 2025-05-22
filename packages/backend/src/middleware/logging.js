/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/middleware/logging.js
 */

import { logger } from '../config/index.js';

function requestLogger(req, res, next) {
  logger.info(`${req.method} ${req.originalUrl || req.url}`, {
    headers: req.headers,
    ip: req.ip,
    method: req.method,
    path: req.originalUrl || req.url,
    query: req.query,
  });
  next();
}

function responseLogger(req, res, next) {
  const oldSend = res.send;
  res.send = function send(...args) {
    res.on('finish', () => {
      logger.info(`Response status: ${res.statusCode} for ${req.method} ${req.originalUrl || req.url}`);
    });
    oldSend.apply(res, args);
  };
  next();
}
export { requestLogger, responseLogger };
