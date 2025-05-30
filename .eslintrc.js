module.exports = {
  extends: ['eslint:recommended'],
  env: { node: true, browser: true, es2021: true },
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  rules: {
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
  },
  overrides: [
    {
      files: ['**/tests/**/*.js', '**/*.spec.js', '**/*.test.js'],
      rules: {
        'no-console': 'off'
      }
    }
  ]
};