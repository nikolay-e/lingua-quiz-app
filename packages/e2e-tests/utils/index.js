// packages/e2e-tests/utils/index.js
import { QUIZ_CONSTANTS, AUTH_CONSTANTS } from './constants';
import { log, logToBoth, createLogger } from './logging';

export default {
  // Logging utilities
  log,
  logToBoth,
  createLogger,

  // Constants
  QUIZ_CONSTANTS,
  AUTH_CONSTANTS,
};
