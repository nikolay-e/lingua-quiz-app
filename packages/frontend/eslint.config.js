import globals from 'globals';
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default [
  {
    ignores: ['node_modules/', 'dist/', 'build/', '.svelte-kit/'],
  },
  // TypeScript files in src
  {
    files: ['src/**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      'max-len': ['error', { code: 150, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
    },
  },
  // Config files
  {
    files: ['vite.config.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.config.json',
        tsconfigRootDir: __dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off',
      'max-len': ['error', { code: 150, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
    },
  },
  // Svelte files
  ...svelte.configs['flat/recommended'],
  {
    files: ['src/**/*.svelte'],
    languageOptions: {
      parser: svelteParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        parser: tsparser,
        extraFileExtensions: ['.svelte'],
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...svelte.configs['flat/recommended'][1].rules,
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-unused-vars': 'off',
      'no-undef': 'off', // TypeScript handles this
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'max-len': ['error', { code: 150, ignoreUrls: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      // Disable rules that require type info for Svelte
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
];
