let serverAddress;

if (window.location.hostname === 'localhost' && window.location.port === '8080') {
  serverAddress = 'http://localhost:9000/api';
} else if (window.location.hostname === 'frontend') {
  serverAddress = 'http://backend:9000/api';
} else if (window.location.hostname === 'test-lingua-quiz.nikolay-eremeev.com') {
  serverAddress = 'https://test-api-lingua-quiz.nikolay-eremeev.com/api';
} else if (window.location.hostname === 'lingua-quiz.nikolay-eremeev.com') {
  serverAddress = 'https://api-lingua-quiz.nikolay-eremeev.com/api';
} else {
  // Default fallback for any other hostname
  // eslint-disable-next-line no-console
  console.warn(`Unknown hostname: ${window.location.hostname}, defaulting to production API`);
  serverAddress = 'https://api-lingua-quiz.nikolay-eremeev.com/api';
}

// Log the configured server address for debugging
// eslint-disable-next-line no-console
console.log(`Configured server address: ${serverAddress} for hostname: ${window.location.hostname}`);

export default serverAddress;
