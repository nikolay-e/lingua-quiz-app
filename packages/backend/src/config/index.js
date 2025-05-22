/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/config/index.js
 */

import winston from 'winston';

import * as ENV from './env.js';

// Status type constants
const STATUS = {
  LEARNED: 'learned',
  LEARNING: 'learning',
  LEVEL_0: 'LEVEL_0',
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
  LEVEL_4: 'LEVEL_4',
  LEVEL_5: 'LEVEL_5',
  REFRESHING: 'refreshing',
};
// Logger configuration
const logger = winston.createLogger({
  format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
  level: ENV.LOG_LEVEL || 'info',
  defaultMeta: { service: 'linguaquiz-backend' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(winston.format.colorize(), winston.format.simple()),
    }),
  ],
});

// Only add file transports in development
if (ENV.NODE_ENV !== 'production') {
  logger.add(new winston.transports.File({ filename: 'error.log', level: 'error' }));
  logger.add(new winston.transports.File({ filename: 'combined.log' }));
  logger.exceptions.handle(new winston.transports.File({ filename: 'exceptions.log' }));
  logger.rejections.handle(new winston.transports.File({ filename: 'rejections.log' }));
}

export { STATUS, logger };
export * as ENV from './env.js';
export { validateEnvironment } from './env.js';
