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

// packages/e2e-tests/utils/logging.js

// Safe console methods
const ALLOWED_CONSOLE_METHODS = new Set(['log', 'info', 'warn', 'error', 'debug']);

/**
 * Creates a formatted timestamp for logs
 * @returns {string} Formatted timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Logs a message with a timestamp and optional context
 * @param {string} message - Message to log
 * @param {string} level - Log level ('log', 'info', 'warn', 'error', 'debug')
 * @param {string} context - Optional context (e.g., test name, component)
 */
function log(message, level = 'log', context = '') {
  if (!ALLOWED_CONSOLE_METHODS.has(level)) {
    level = 'log';
  }

  const timestamp = getTimestamp();
  const contextPrefix = context ? `[${context}] ` : '';
  console[level](`[${timestamp}] ${contextPrefix}${message}`);
}

/**
 * Logs a message to both Node console and browser console
 * @param {import('@playwright/test').Page} page - Playwright page object
 * @param {string} message - Message to log
 * @param {string} level - Log level ('log', 'info', 'warn', 'error', 'debug')
 * @param {string} context - Optional context
 */
async function logToBoth(page, message, level = 'log', context = '') {
  if (!ALLOWED_CONSOLE_METHODS.has(level)) {
    level = 'log';
  }

  // Log to Node console
  log(message, level, context);

  // Log to browser console if page is available
  if (page) {
    await page.evaluate(
      ({ msg, lvl, ctx }) => {
        const safeLevel = ['log', 'info', 'warn', 'error', 'debug'].includes(lvl) ? lvl : 'log';
        const contextPrefix = ctx ? `[${ctx}] ` : '';
        console[safeLevel](`Browser: ${contextPrefix}${msg}`);
      },
      { msg: message, lvl: level, ctx: context }
    );
  }
}

/**
 * Creates a test logger with a fixed context
 * @param {string} context - Default context for all logs
 * @returns {Object} Logger object with methods for each log level
 */
function createLogger(context) {
  return {
    log: (message) => log(message, 'log', context),
    info: (message) => log(message, 'info', context),
    warn: (message) => log(message, 'warn', context),
    error: (message) => log(message, 'error', context),
    debug: (message) => log(message, 'debug', context),

    // Browser console logging methods
    logToBoth: async (page, message) => await logToBoth(page, message, 'log', context),
    infoToBoth: async (page, message) => await logToBoth(page, message, 'info', context),
    warnToBoth: async (page, message) => await logToBoth(page, message, 'warn', context),
    errorToBoth: async (page, message) => await logToBoth(page, message, 'error', context),
    debugToBoth: async (page, message) => await logToBoth(page, message, 'debug', context),
  };
}

export { log, logToBoth, createLogger };
