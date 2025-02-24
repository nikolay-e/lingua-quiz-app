// src/js/config.js
const getServerAddress = () => {
  const { hostname } = window.location;

  // Check if we're running integration tests
  if (hostname === undefined) {
    return 'https://test-api-lingua-quiz.nikolay-eremeev.com';
  }

  // Check if we're running locally via Docker
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return 'http://localhost:3000';
  }

  // Check if we're in test environment
  if (hostname.includes('test-')) {
    return 'https://test-api-lingua-quiz.nikolay-eremeev.com';
  }

  // otherwise production
  return 'https://api-lingua-quiz.nikolay-eremeev.com';
};

const serverAddress = getServerAddress();

export default serverAddress;
