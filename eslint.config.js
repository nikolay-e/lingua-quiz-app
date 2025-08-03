import fs from 'node:fs';
import globals from 'globals';
import js from '@eslint/js';

// Helper function to trim whitespace from keys in the globals object
function cleanGlobals(globalsObject) {
  return Object.fromEntries(Object.entries(globalsObject).map(([key, value]) => [key.trim(), value]));
}

// Read .gitignore and parse its patterns
const gitignoreContent = fs.readFileSync('.gitignore', 'utf8');
const gitignorePatterns = gitignoreContent.split('\n').filter((line) => line && !line.startsWith('#'));

export default [
  // 1. Global ignores
  {
    ignores: ['node_modules/', ...gitignorePatterns],
  },

  // 2. Main configuration
  {
    files: ['**/*.js'],
    rules: {
      ...js.configs.recommended.rules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
    languageOptions: {
      // Use the helper function to clean the globals
      globals: {
        ...cleanGlobals(globals.browser),
        ...cleanGlobals(globals.node),
      },
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },

  // 3. Overrides for test files
  {
    files: ['**/tests/**/*.js', '**/*.spec.js', '**/*.test.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
