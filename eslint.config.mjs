// eslint.config.js
import js from '@eslint/js';
import prettierConfig from 'eslint-config-prettier';
import importPlugin from 'eslint-plugin-import';
import jestPlugin from 'eslint-plugin-jest';
import jsoncPlugin from 'eslint-plugin-jsonc';
import nodePlugin from 'eslint-plugin-node';
import promisePlugin from 'eslint-plugin-promise';
import securityPlugin from 'eslint-plugin-security';
import sonarjsPlugin from 'eslint-plugin-sonarjs';
import unicornPlugin from 'eslint-plugin-unicorn';
import globals from 'globals';

// Import Plugins
import * as jsoncParser from 'jsonc-eslint-parser';

// Import Prettier config (Must be LAST)

export default [
  // 1. Global Ignore Patterns
  {
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'packages/frontend/coverage/',
      '.env',
      'logs/',
      '*.log',
      '*.py',
      'packages/backend/helm/**/templates/**/*',
      '.treemapperignore',
      '.husky/_/',
      'package-lock.json',
      '**/tests/.test.env',
      'Generated -- *.sql',
      '*_words.sql', // Ignore SQL migration files containing word lists
      'packages/backend/migrations/*_import_*_words.sql', // Specifically ignore word import SQL files
      'word_processing_scripts/',
      '*.csv',
    ],
  },

  // 2. Base JS Configuration
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.browser, // Add browser globals for frontend code
      },
    },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    plugins: {
      import: importPlugin,
      promise: promisePlugin,
      sonarjs: sonarjsPlugin,
      node: nodePlugin,
      unicorn: unicornPlugin,
    },
    settings: {
      'import/resolver': { node: { extensions: ['.js', '.mjs', '.cjs'] } },
      node: { version: '>=22.0.0' },
    },
    rules: {
      // Base ESLint recommended
      ...js.configs.recommended.rules,
      // Promise recommended
      ...promisePlugin.configs.recommended?.rules,
      // SonarJS recommended
      ...sonarjsPlugin.configs.recommended?.rules,
      // Node recommended
      ...nodePlugin.configs['flat/recommended-module']?.rules,
      'node/no-missing-import': 'off',
      'node/no-unpublished-import': 'off',
      'node/no-extraneous-import': 'off',
      // Unicorn recommended
      ...unicornPlugin.configs.recommended?.rules,
      // --- Project-specific rule adjustments ---
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/filename-case': 'off', // Turn off filename case rules
      'unicorn/no-null': 'off',
      'unicorn/import-style': 'off',
      'unicorn/no-process-exit': 'off',
      'unicorn/prefer-module': 'off', // Allow require() usage
      'unicorn/expiring-todo-comments': 'off',

      // Import rules
      'import/no-unresolved': 'warn',
      'import/named': 'warn',
      'import/default': 'warn',
      'import/namespace': 'warn',
      'import/export': 'warn',
      'import/no-named-as-default': 'warn',
      'import/no-named-as-default-member': 'warn',
      'import/no-duplicates': 'warn',
      'import/extensions': ['warn', 'ignorePackages', { js: 'never', cjs: 'never', mjs: 'never' }],
      'import/order': [
        'warn',
        {
          groups: [
            'builtin',
            'external',
            'internal',
            ['parent', 'sibling', 'index'],
            'object',
            'type',
          ],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      'import/no-mutable-exports': 'warn',
      'import/no-cycle': ['warn', { maxDepth: 5 }],

      // General Overrides/Adjustments
      'eol-last': ['warn', 'always'],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug', 'log'] }],
      'no-unused-vars': [
        'warn',
        { varsIgnorePattern: '^_', argsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      'no-underscore-dangle': [
        'warn',
        { allow: ['__TESTCONTAINER__', '__SERVER__', '_authCheckInterval'] },
      ],
      // Enable browser globals in .languageOptions

      // Stricter checks
      eqeqeq: ['warn', 'always', { null: 'ignore' }],
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-throw-literal': 'warn',
      'prefer-promise-reject-errors': 'warn',
      'no-async-promise-executor': 'warn',
      'no-await-in-loop': 'warn',
      radix: 'warn',
      // 'no-undef' defined above with globals
      'unicorn/prefer-top-level-await': 'warn',
      'sonarjs/no-hardcoded-passwords': 'warn',
      'sonarjs/unused-import': 'warn',
      'sonarjs/no-unused-vars': 'warn',
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-dead-store': 'warn',
      'unicorn/prefer-query-selector': 'warn',
      'unicorn/prefer-add-event-listener': 'warn',
      'unicorn/no-invalid-remove-event-listener': 'warn',
      'sonarjs/cognitive-complexity': 'warn',
      'promise/always-return': 'warn',
      'sonarjs/no-clear-text-protocols': 'warn',
      'unicorn/consistent-function-scoping': 'warn',
      // 'unicorn/prefer-module' already disabled above
      'sonarjs/pseudo-random': 'warn',
      'unicorn/prefer-dom-node-text-content': 'warn',
      'sonarjs/no-redundant-assignments': 'warn',
      'sonarjs/no-skipped-tests': 'warn',
      'sonarjs/slow-regex': 'warn',
      'unicorn/no-anonymous-default-export': 'warn',
      'no-self-assign': 'warn',
      'sonarjs/cors': 'warn',
      'unicorn/no-array-reduce': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'unicorn/prefer-number-properties': 'warn',
      'unicorn/prefer-ternary': 'warn',
      'no-empty-pattern': 'warn',
      'sonarjs/no-os-command-from-path': 'warn',
      'unicorn/prefer-structured-clone': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
      'sonarjs/void-use': 'warn',
      'unicorn/no-useless-promise-resolve-reject': 'warn',

      yoda: 'warn',
      'object-shorthand': ['warn', 'properties'],
      // camelcase rule
      camelcase: [
        'warn',
        {
          properties: 'always',
          ignoreDestructuring: false,
          ignoreImports: true,
          allow: [
            'translation_ids',
            'secret_key',
            'access_key_id',
            'quiz_name',
            'word_pair_id',
            'repo_name',
            'pr_number',
            'caseInsensitive',
            '__TESTCONTAINER__',
            '__SERVER__',
            'image_tag_out',
            'deploy_env_out',
            'image_name_out',
            'latest_tag_out',
            'helm_release_name_out',
            'quiz_names',
            'p_translation_id',
            'p_source_word_id',
            'p_target_word_id',
            'KUBE_CONFIG_DATA',
            'source_word_usage_example',
            'target_word_usage_example',
            'API_URL',
            'POSTGRES_DB',
            'POSTGRES_USER',
            'POSTGRES_PASSWORD',
            'DB_HOST',
            'DB_PORT',
            'JWT_SECRET',
            'JWT_EXPIRES_IN',
            'NODE_ENV',
            'SECRET_SSL_CERT',
            'SECRET_SSL_KEY',
            'SECRET_KUBE_CONFIG',
            'API_HOST_ENV',
            'DEPLOY_PORT_ENV',
            'SSL_CERT_PATH_ENV',
            'SSL_KEY_PATH_ENV',
            'DEPLOY_NAMESPACE',
            'IMAGE_TAG',
            'HELM_RELEASE_NAME',
            'IMAGE_NAME_FOR_HELM',
            'POSTGRES_SECRET_NAME',
            'DB_HOST_VALUE',
            'BACKUP_IMAGE_REPO',
            'BACKUP_IMAGE_TAG',
            'BACKUP_RELEASE_NAME',
            'BACKUP_NAMESPACE',
            'MAIN_APP_RELEASE_NAME',
            'TEST_USER_EMAIL',
            'TEST_USER_PASSWORD',
            'NODE_TLS_REJECT_UNAUTHORIZED',
            'v_word_list_id',
            'v_source_language_id',
            'v_target_language_id',
            'v_source_word_id',
            'v_target_word_id',
            'lingua_quiz_url',
            'user_id',
            'created_at',
            'updated_at',
            'word_list_id',
          ],
        },
      ],
    },
  },

  // 3. Security Plugin Rules
  {
    plugins: { security: securityPlugin },
    rules: {
      ...(securityPlugin.configs.recommended?.rules || {
        'security/detect-buffer-noassert': 'warn',
        'security/detect-child-process': 'warn',
        'security/detect-eval-with-expression': 'warn',
        'security/detect-non-literal-fs-filename': 'warn',
        'security/detect-non-literal-regexp': 'warn',
        'security/detect-non-literal-require': 'warn',
        'security/detect-object-injection': 'warn',
        'security/detect-possible-timing-attacks': 'warn',
        'security/detect-pseudoRandomBytes': 'warn',
        'security/detect-unsafe-regex': 'warn',
      }),
      'security/detect-object-injection': ['warn'],
    },
  },

  // --- FILE SPECIFIC OVERRIDES ---

  // 4. CommonJS Files
  {
    files: [
      '**/*.cjs',
      '**/*.config.js',
      '**/*.config.cjs',
      'server.js',
      'runMigrations.js',
      'packages/backend/jest.config.js',
      'packages/backend/babel.config.js',
      'packages/frontend/babel.config.cjs',
      'packages/frontend/jest.config.cjs',
    ],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
    plugins: { node: nodePlugin },
    rules: {
      'unicorn/prefer-module': 'off',
      'import/no-commonjs': 'off',
      'node/no-unsupported-features/es-syntax': 'off',
      strict: ['warn', 'global'],
      'no-console': 'off',
      'security/detect-non-literal-require': 'off',
      'unicorn/no-process-exit': 'off',
      'global-require': 'off',
    },
  },

  // 5. Test Files
  {
    files: [
      '**/tests/**/*.js',
      '**/*.test.js',
      '**/*.spec.js',
      'packages/backend/tests/**/*.js',
      'packages/frontend/tests/**/*.js',
      'packages/e2e-tests/tests/**/*.js',
    ],
    languageOptions: {
      globals: { ...globals.jest, ...globals.node },
    },
    plugins: { jest: jestPlugin },
    rules: {
      ...jestPlugin.configs.recommended?.rules,
      'jest/expect-expect': [
        'warn',
        { assertFunctionNames: ['expect', 'request.*.expect', '*.expect'] },
      ],
      'jest/no-disabled-tests': 'warn',
      'jest/no-focused-tests': 'warn',
      'jest/prefer-to-have-length': 'warn',
      'jest/valid-title': 'warn',
      'jest/no-standalone-expect': 'off',
      'jest/no-conditional-expect': 'warn',
      'jest/no-mocks-import': 'off', // Allow direct imports from __mocks__ directory
      'import/extensions': 'off', // Don't enforce file extensions in tests
      'no-unused-expressions': 'off',
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/no-identical-functions': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-identical-functions': 'off',
      'unicorn/no-useless-undefined': 'off',
      'max-classes-per-file': 'off',
      'node/global-require': 'off',
      'import/no-extraneous-dependencies': ['warn', { devDependencies: true }],
      'no-console': 'off',
      'security/detect-object-injection': 'off',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },

  // 6. JSON Files Configuration
  {
    files: ['**/*.json', '**/*.jsonc', '.vscode/*.json'],
    languageOptions: { parser: jsoncParser },
    plugins: { jsonc: jsoncPlugin },
    rules: {
      ...jsoncPlugin.configs['recommended-with-jsonc']?.rules,
      'unicorn/expiring-todo-comments': 'off', // Keep disabled for JSON
      'jsonc/array-bracket-spacing': ['warn', 'never'],
      'jsonc/comma-dangle': ['warn', 'never'],
      'jsonc/comma-style': ['warn', 'last'],
      'jsonc/key-spacing': ['warn', { beforeColon: false, afterColon: true }],
      'jsonc/object-curly-newline': ['warn', { consistent: true }],
      'jsonc/object-curly-spacing': ['warn', 'always'],
      'jsonc/object-property-newline': ['warn', { allowMultiplePropertiesPerLine: true }],
      'jsonc/indent': ['warn', 2],
    },
  },

  // 8. --- PRETTIER MUST BE THE LAST ELEMENT ---
  prettierConfig,
];
