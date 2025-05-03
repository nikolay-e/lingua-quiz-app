const _ = require('lodash');
const xss = require('xss');

/**
 * Recursively sanitizes input to prevent XSS attacks
 * @param {any} obj - The input to sanitize
 * @returns {any} - The sanitized input
 */
function sanitizeInput(obj) {
  if (typeof obj !== 'object' || obj === null) {
    return xss(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeInput(item));
  }

  return Object.keys(obj).reduce((acc, key) => {
    acc[key] = sanitizeInput(obj[key]);
    return acc;
  }, {});
}

/**
 * Recursively converts all object keys to camelCase
 * @param {any} obj - The object with keys to convert
 * @returns {any} - The object with camelCase keys
 */
function convertKeysToCamelCase(obj) {
  if (Array.isArray(obj)) {
    return obj.map((item) => convertKeysToCamelCase(item));
  }

  if (obj !== null && typeof obj === 'object') {
    return Object.entries(obj).reduce((acc, [key, value]) => {
      const newKey = _.camelCase(key);
      acc[newKey] = convertKeysToCamelCase(value);
      return acc;
    }, {});
  }

  return obj;
}

/**
 * Safely escapes a string for use in SQL
 * @param {string} str - The string to escape
 * @returns {string} - The escaped string
 */
function escapeSQL(str) {
  if (typeof str !== 'string') return str;
  return str.replaceAll("'", "''").replaceAll('\\', '\\\\');
}

module.exports = {
  sanitizeInput,
  convertKeysToCamelCase,
  escapeSQL,
};
