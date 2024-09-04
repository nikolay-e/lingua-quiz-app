const { defineConfig } = require('cypress');

module.exports = defineConfig({
  e2e: {
    baseUrl: process.env.LINGUA_QUIZ_URL,
    specPattern: 'cypress/e2e/**/*.cy.js',
    defaultCommandTimeout: 10000,
    video: true,
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
});
