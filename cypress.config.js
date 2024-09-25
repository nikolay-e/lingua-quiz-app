const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.LINGUA_QUIZ_URL || 'https://test-lingua-quiz.nikolay-eremeev.com',
    apiUrl: process.env.API_URL || 'https://test-api-lingua-quiz.nikolay-eremeev.com',
    specPattern: 'cypress/e2e/**/*.cy.js',
    defaultCommandTimeout: 10000,
    video: true,
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
});
