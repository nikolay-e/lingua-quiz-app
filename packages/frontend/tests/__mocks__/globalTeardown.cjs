/**
 * Global teardown file for Jest tests that need Docker services
 * This runs after all tests and cleans up any infrastructure
 */
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');

// Paths
const rootDir = resolve(__dirname, '../../../..');

/**
 * Teardown function that runs after all tests
 * Cleans up Docker containers if they were started by the test setup
 */
async function globalTeardown() {
  // Skip Docker teardown if explicitly disabled
  if (process.env.SKIP_DOCKER === 'true') {
    return;
  }

  // Check if we started Docker containers
  const dockerStartedByTest = global.__DOCKER_STARTED_BY_TEST__;

  // Clean up if we started the containers
  if (dockerStartedByTest) {
    console.log('🧹 Tests completed. Cleaning up Docker containers...');
    spawnSync('npm', ['run', 'docker:down'], {
      cwd: rootDir,
      stdio: 'inherit',
    });
    console.log('✅ Docker containers stopped');
  } else {
    console.log('Skipping Docker cleanup as containers were already running before tests');
  }
}

module.exports = globalTeardown;
