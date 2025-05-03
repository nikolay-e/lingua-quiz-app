/**
 * Global setup file for Jest tests that need Docker services
 * This runs before all tests and sets up any necessary infrastructure
 */
const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const path = require('node:path');

// Paths
const rootDir = resolve(__dirname, '../../../..');

// Global variable to track if we started the Docker containers
let dockerStartedByTest = false;

/**
 * Setup function that runs before all tests
 */
async function globalSetup() {
  // Skip Docker setup if explicitly disabled
  if (process.env.SKIP_DOCKER === 'true') {
    return;
  }

  console.log('🚀 Setting up Docker containers for component tests...');

  // Check if Docker containers are already running
  console.log('Checking if Docker containers are running...');
  const containerCheck = spawnSync('docker', ['ps', '--format', '{{.Names}}'], {
    cwd: rootDir,
    encoding: 'utf8',
  });

  if (containerCheck.error) {
    console.error('Failed to check Docker containers:', containerCheck.error.message);
    throw new Error('Docker container check failed. Make sure Docker is installed and running.');
  }

  const containersRunning =
    containerCheck.stdout.includes('lingua-quiz-backend-local') &&
    containerCheck.stdout.includes('lingua-quiz-db-local');

  // Start containers if needed
  if (containersRunning) {
    console.log('Docker containers are already running.');
    dockerStartedByTest = false;
  } else {
    console.log('Starting Docker containers...');
    const dockerUp = spawnSync('npm', ['run', 'docker:up'], {
      cwd: rootDir,
      stdio: 'inherit',
      encoding: 'utf8',
    });

    if (dockerUp.status !== 0) {
      throw new Error('Failed to start Docker containers.');
    }

    dockerStartedByTest = true;

    // Wait for services to be ready - using a longer timeout for initial setup
    console.log('Waiting for services to be ready...');
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }

  // Check API connectivity before running tests
  console.log('Testing API connectivity...');
  try {
    // Test the health endpoint
    console.log('Testing health endpoint...');
    const healthCheck = spawnSync('curl', ['-s', 'http://localhost:9000/api/health']);

    if (healthCheck.error) {
      throw new Error(`Health check failed: ${healthCheck.error.message}`);
    }

    console.log('Health endpoint response:', healthCheck.stdout.toString().trim());

    // Set environment variable to indicate Docker is ready
    process.env.DOCKER_READY = 'true';
    process.env.USE_REAL_API = 'true';
    process.env.API_URL = 'http://localhost:9000/api';

    // Store if we started Docker in a global variable that can be read by teardown
    global.__DOCKER_STARTED_BY_TEST__ = dockerStartedByTest;

    console.log('✅ Docker setup completed successfully');
  } catch (error) {
    console.error('API connectivity test failed! Error:', error.message);

    // If we started Docker, clean it up on failure
    if (dockerStartedByTest) {
      cleanupDocker();
    }

    throw new Error('API connectivity failed. Tests cannot proceed.');
  }
}

/**
 * Helper function to clean up Docker containers
 */
function cleanupDocker() {
  console.log('Stopping Docker containers...');
  spawnSync('npm', ['run', 'docker:down'], {
    cwd: rootDir,
    stdio: 'inherit',
  });
}

module.exports = globalSetup;
