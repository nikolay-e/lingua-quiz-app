module.exports = {
  env: {
    browser: true,
    es2021: true,
    mocha: true,
    'cypress/globals': true,
  },
  extends: ['airbnb-base', 'plugin:prettier/recommended', 'plugin:cypress/recommended'],
  overrides: [
    {
      files: ['cypress.config.js'],
      rules: {
        'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      },
    },
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  plugins: ['prettier', 'mocha', 'cypress'],
  rules: {
    'prettier/prettier': [
      'error',
      {
        printWidth: 100,
        singleQuote: true,
        trailingComma: 'es5',
      },
    ],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'max-len': ['error', { code: 100 }],
    'import/no-mutable-exports': 'off',
    'import/extensions': 'off',
    'no-unused-vars': [
      'error',
      {
        varsIgnorePattern: '^_',
        argsIgnorePattern: '^_',
      },
    ],
  },
};
