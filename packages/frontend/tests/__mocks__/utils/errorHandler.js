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

/**
 * Standard mock for the errorHandler module.
 * This should be used across all tests that need to mock error handling functionality.
 */

// Create mock functions with mockName for better error messages
const handleApiError = jest.fn().mockName('errorHandler.handleApiError');
const showError = jest.fn().mockName('errorHandler.showError');
const init = jest.fn().mockName('errorHandler.init');

// Export singleton errorHandler object that matches the real implementation's interface
export const errorHandler = {
  handleApiError,
  showError,
  init,

  // Additional properties that may be needed in specific tests
  errorContainer: null,
  maxErrors: 5,

  // Helper to reset all mocks between tests
  _reset() {
    handleApiError.mockClear();
    showError.mockClear();
    init.mockClear();
  },
};

// Default mock implementations
errorHandler.init.mockImplementation(function () {
  // First try to find an existing container
  const existingContainer = document.querySelector('#error-container');
  if (existingContainer) {
    this.errorContainer = existingContainer;
  } else {
    // Create new container if needed
    this.errorContainer = document.createElement('div');
    this.errorContainer.id = 'error-container';
    this.errorContainer.style.position = 'fixed';
    this.errorContainer.style.top = '20px';
    this.errorContainer.style.right = '20px';
    this.errorContainer.style.maxWidth = '300px';
    this.errorContainer.style.zIndex = '9999';
    document.body.append(this.errorContainer);
  }
});

errorHandler.showError.mockImplementation(function (message) {
  console.error(`[MOCK] Error: ${message}`);
  // Simple implementation to add error to DOM if container exists
  if (this.errorContainer) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.dataset.testid = 'error-message';
    errorElement.textContent = message;
    this.errorContainer.append(errorElement);
  }
});

errorHandler.handleApiError.mockImplementation(function (error) {
  console.error('[MOCK] API Error:', error);

  // Extract error message from various possible sources
  let errorMessage = 'An unexpected error occurred';

  if (error.message) {
    errorMessage = error.message;
  } else if (error.response && error.response.data && error.response.data.message) {
    errorMessage = error.response.data.message;
  }

  this.showError(errorMessage);
});
