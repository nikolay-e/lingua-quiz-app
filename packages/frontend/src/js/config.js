// Check if we're in a test environment (Jest)
const isTestEnvironment = typeof process !== 'undefined' && process.env && process.env.USE_REAL_API === 'true';
const injectedApiUrl = isTestEnvironment ? process.env.API_URL : window.linguaQuizApiUrl;
let serverAddress;

console.log(`[config.js] Reading API URL: "${injectedApiUrl}", Test Environment: ${isTestEnvironment}`);

// Handle test environment
if (isTestEnvironment) {
  serverAddress = (injectedApiUrl || 'http://localhost:9000').replace(/\/api$/, '');
  console.log(`[config.js] Using E2E test API URL: ${serverAddress}`);
}
// Check if the URL was successfully injected and isn't the placeholder
else if (injectedApiUrl && injectedApiUrl !== '${API_URL}' && injectedApiUrl !== 'undefined') {
  serverAddress = injectedApiUrl;
  console.log(`[config.js] Using injected API URL: ${serverAddress}`);
} else {
  // Fallback logic if injection failed or wasn't performed
  // This might happen in local development without the substitution step
  // Or if the placeholder value remains.
  const { hostname, port } = window.location || {};
  console.warn(
    `[config.js] API URL not injected or is placeholder. Falling back to hostname/port detection (hostname: "${hostname}", port: "${port}").`
  );

  // Docker container environment - services use container names for networking
  if (hostname === 'frontend') {
    serverAddress = 'http://backend:9000';
    console.log(
      `[config.js] Fallback: Detected Docker container environment. API URL: ${serverAddress}`
    );
  } else if (hostname === 'localhost' && port === '8080') {
    serverAddress = 'http://localhost:9000';
    console.log(
      `[config.js] Fallback: Detected localhost:8080 environment. API URL: ${serverAddress}`
    );
  } else if (hostname === 'test-lingua-quiz.nikolay-eremeev.com') {
    serverAddress = 'https://test-api-lingua-quiz.nikolay-eremeev.com';
    console.log(`[config.js] Fallback: Detected K8s Test environment. API URL: ${serverAddress}`);
  } else if (hostname === 'lingua-quiz.nikolay-eremeev.com') {
    serverAddress = 'https://api-lingua-quiz.nikolay-eremeev.com';
    console.log(`[config.js] Fallback: Detected K8s Prod environment. API URL: ${serverAddress}`);
  } else {
    console.error(
      `[config.js] Fallback: Could not determine API URL for hostname: "${hostname}". Using default.`
    );
    serverAddress = 'http://localhost:9000'; // Final fallback default
  }
}

if (!serverAddress) {
  console.error('[config.js] FATAL: serverAddress could not be determined!');
  // Display error to user? Or default to prevent crashes?
  serverAddress = 'http://error-url-not-configured'; // Prevent undefined errors downstream
}

export default serverAddress;
