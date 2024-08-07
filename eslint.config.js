import js from '@eslint/js';
import globals from 'globals';
import prettier from 'eslint-plugin-prettier';
import security from 'eslint-plugin-security';
import mocha from 'eslint-plugin-mocha';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        myCustomGlobal: 'readonly',
      },
    },
    plugins: {
      prettier,
      security,
      mocha,
    },
    rules: {
      ...security.configs.recommended.rules,
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
    },
  },
  {
    files: ['**/tests/**'],
    languageOptions: {
      globals: {
        ...globals.mocha,
      },
    },
  },
];
