import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import sveltePlugin from 'eslint-plugin-svelte';
import globals from 'globals';
import path from 'path';
import { fileURLToPath } from 'url';
import prettierConfig from 'eslint-config-prettier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default tseslint.config(
  // Base configs
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...sveltePlugin.configs['flat/recommended'],

  // Global settings for all files
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      // General best practices
      'prefer-const': 'error',
      'no-var': 'error',
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Turn off base rule to use the TS-aware version
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_'
      }],

      // General TS rules that don't require type info
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    }
  },

  // Configuration for TypeScript files requiring type information
  {
    files: ['packages/*/src/**/*.ts', 'packages/*/tests/**/*.ts'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // Stricter rules for TS files
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-readonly': 'warn',
    },
  },

  // Configuration for Svelte files
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parser: sveltePlugin.parser,
      parserOptions: {
        parser: tseslint.parser, 
        project: ['./packages/*/tsconfig.json', './packages/core/tsconfig.lint.json'],
        tsconfigRootDir: __dirname,
        extraFileExtensions: ['.svelte'],
      },
    },
    rules: {
      // Svelte-specific rules
      'svelte/no-at-debug-tags': 'error',
      'svelte/no-unused-svelte-ignore': 'error',

      // Svelte breaks the base 'no-undef' rule, so it must be off
      'no-undef': 'off',
      
      // Type-aware rules for Svelte
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
    },
  },

  // Overrides for test and config files
  {
    files: [
      '**/tests/**/*.{js,ts}',
      '**/*.{test,spec}.{js,ts}',
      '**/e2e-tests/**/*.{js,ts}',
      '**/*.config.{js,ts}',
      'eslint.config.js'
    ],
    rules: {
      'no-console': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  
  // Ignore patterns
  {
    ignores: [
      'node_modules',
      'dist',
      'build',
      '.svelte-kit',
      'coverage',
      'playwright-report',
      'test-results',
      '**/*.min.js',
    ],
  },
  
  // Prettier config must be last to override other formatting rules
  prettierConfig
);