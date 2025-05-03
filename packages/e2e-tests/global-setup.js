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

// packages/e2e-tests/global-setup.js

/**
 * Global setup function - runs once before all tests
 * Note: This function doesn't receive a browser context
 */
async function globalSetup() {
  // Basic setup for all tests
  console.log(`[${new Date().toISOString()}] Running global setup`);

  // Return an object that will be passed to globalTeardown if needed
  return {};
}

export default globalSetup;
