/*
 * LinguaQuiz - Copyright © 2025 Nikolay Eremeev
 *
 * Dual-licensed:
 *  - Non-Commercial Source-Available v2  →  see LICENSE-NONCOMMERCIAL.md
 *  - Commercial License v2               →  see LICENSE-COMMERCIAL.md
 *
 * Contact: lingua-quiz@nikolay-eremeev.com
 * Repository: https://github.com/nikolay-e/lingua-quiz
 * File: packages/backend/src/utils/helpers.js
 */

// escapeSQL function removed - use parameterized queries with placeholders
// instead of string concatenation for SQL queries to prevent SQL injection

function convertKeysToCamelCase(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item));
  }

  const result = {};
  Object.keys(obj).forEach((key) => {
    if (Object.hasOwn(obj, key)) {
      // Convert snake_case to camelCase
      const camelKey = key.replaceAll(/_([a-z])/g, (_, c) => c.toUpperCase());

      // Handle nested objects recursively
      result[camelKey] = convertKeysToCamelCase(obj[key]);
    }
  });

  return result;
}

function trimInput(input) {
  if (typeof input === 'string') {
    // Basic trimming for strings
    return input.trim();
  }

  if (Array.isArray(input)) {
    // Handle arrays by processing each element
    return input.map((item) => trimInput(item));
  }

  if (input && typeof input === 'object') {
    // Handle nested objects
    const result = {};
    Object.keys(input).forEach((key) => {
      if (Object.hasOwn(input, key)) {
        result[key] = trimInput(input[key]);
      }
    });

    return result;
  }

  return input;
}

export { convertKeysToCamelCase, trimInput };
