let serverAddress;

if (window.location.hostname === 'localhost' && window.location.port === '8080') {
  serverAddress = 'http://localhost:9000';
} else if (window.location.hostname === 'frontend') {
  serverAddress = 'http://backend:9000';
} else if (window.location.hostname === 'test-lingua-quiz.nikolay-eremeev.com') {
  serverAddress = 'https://test-api-lingua-quiz.nikolay-eremeev.com';
} else if (window.location.hostname === 'lingua-quiz.nikolay-eremeev.com') {
  serverAddress = 'https://api-lingua-quiz.nikolay-eremeev.com';
}

export default serverAddress;
