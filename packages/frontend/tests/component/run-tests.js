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
#!/usr/bin/env node

/**
 * Script to run Jest-based E2E tests with real backend API via Docker
 *
 * This script:
 * 1. Checks if Docker containers are running
 * 2. Starts them if needed
 * 3. Runs the component tests with real API enabled
 */

// Use ES Modules syntax since the package is set to type: "module"
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import fetch from 'node-fetch';

// Get current directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Paths
const rootDir = resolve(__dirname, '../../../');
const frontendDir = resolve(__dirname, '../..');

// Use an async IIFE to allow top-level await
(async () => {
  try {
    await runTests();
  } catch (error) {
    console.error('Error running tests:', error);
    process.exit(1);
  }
})();

async function runTests() {
  // Check if Docker containers are running
  console.log('Checking if Docker containers are running...');
  const containerCheck = spawnSync('docker', ['ps', '--format', '{{.Names}}'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (containerCheck.error) {
    console.error('Failed to check Docker containers:', containerCheck.error.message);
    process.exit(1);
  }

  const containersRunning =
    containerCheck.stdout.includes('lingua-quiz-backend-local') &&
    containerCheck.stdout.includes('lingua-quiz-db-local');

  // Start containers if needed
  if (containersRunning) {
    console.log('Docker containers are already running.');
  } else {
    console.log('Starting Docker containers...');
    const dockerUp = spawnSync('npm', ['run', 'docker:up'], {
      cwd: rootDir,
      stdio: 'inherit',
      encoding: 'utf8',
    });

    if (dockerUp.status !== 0) {
      console.error('Failed to start Docker containers.');
      process.exit(1);
    }

    console.log('Waiting for services to be ready...');
    // Wait for backend to be fully started
    spawnSync('sleep', ['15'], { stdio: 'inherit' });
  }

  // Check API connectivity before running tests
  console.log('Testing API connectivity...');
  try {
    // Test the health endpoint
    console.log('Testing health endpoint...');
    const healthCurl = spawnSync('curl', ['-s', 'http://localhost:9000/api/health']);

    if (healthCurl.error) {
      throw new Error(`curl to health endpoint failed: ${healthCurl.error.message}`);
    }

    console.log('Health endpoint response:', healthCurl.stdout.toString().trim());

    // Test registration endpoint format
    console.log('Testing registration endpoint format...');
    const registerCurl = spawnSync('curl', [
      '-s',
      '-X',
      'POST',
      '-H',
      'Content-Type: application/json',
      '-d',
      '{"email":"test@example.com","password":"Test123!"}',
      'http://localhost:9000/api/auth/register',
    ]);

    if (registerCurl.error) {
      console.error(`curl to register endpoint failed: ${registerCurl.error.message}`);
    } else {
      console.log('Register endpoint response:', registerCurl.stdout.toString().trim());
    }

    console.log('API connectivity checks completed.');
  } catch (error) {
    console.error('API connectivity test failed! Error:', error.message);
    console.error('Make sure Docker containers are running correctly.');
    process.exit(1);
  }

  // Run the tests with real API enabled
  console.log('Running component tests with real API...');
  const testEnv = {
    ...process.env,
    USE_REAL_API: 'true',
    API_URL: 'http://localhost:9000/api',
  };

  // Run Jest with correct path to component tests
  const testResult = spawnSync('npx', ['jest', '--testMatch', '**/tests/component/**/*.test.js'], {
    cwd: frontendDir,
    stdio: 'inherit',
    env: testEnv,
  });

  // Clean up if we started the containers
  if (!containersRunning) {
    console.log('Tests completed. Stopping Docker containers...');
    spawnSync('npm', ['run', 'docker:down'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
  }

  process.exit(testResult.status || 0);
}
