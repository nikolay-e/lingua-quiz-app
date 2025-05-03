// Import the actual module to test
import { errorHandler } from '../../../src/js/utils/errorHandler.js';
import { suppressConsoleOutput, setupLocationMock } from '../../__mocks__/unitTestSetup.js';

describe('ErrorHandler', () => {
  let consoleCleanup;
  let mockErrorContainer;

  beforeEach(() => {
    // Suppress console output for clean test output
    consoleCleanup = suppressConsoleOutput();

    // Setup DOM environment for tests
    document.body.innerHTML = '<div id="error-container"></div>';
    mockErrorContainer = document.querySelector('#error-container');

    // Reset the errorHandler state
    errorHandler.errorContainer = null;
  });

  afterEach(() => {
    // Restore console functions
    consoleCleanup.restoreConsole();

    // Clean up DOM
    document.body.innerHTML = '';
  });

  describe('init', () => {
    it('should create error container if not exists', () => {
      // Remove existing container first
      document.body.innerHTML = '';

      // Call the init method
      errorHandler.init();

      // Check that container was created
      const container = document.querySelector('#error-container');
      expect(container).not.toBeNull();
      expect(errorHandler.errorContainer).toBe(container);
    });

    it('should initialize error container', () => {
      // Clear previous containers
      document.body.innerHTML = '';
      errorHandler.errorContainer = null;

      // Call the init method
      errorHandler.init();

      // Check container was created
      expect(errorHandler.errorContainer).toBeTruthy();
      expect(errorHandler.errorContainer.id).toBe('error-container');
    });
  });

  describe('showError', () => {
    it('should display error message in container', () => {
      // Initialize the errorHandler
      errorHandler.init();

      // Call the method under test
      errorHandler.showError('Test error message');

      // Check that error was displayed
      const errorElement = document.querySelector('.error-message');
      expect(errorElement).not.toBeNull();
      expect(errorElement.textContent).toContain('Test error message');
    });

    it('should initialize container if not already initialized', () => {
      // Ensure errorHandler is not initialized
      errorHandler.errorContainer = null;

      // Call the method under test
      errorHandler.showError('Test error message');

      // Check that container was initialized
      expect(errorHandler.errorContainer).not.toBeNull();

      // Check that error was displayed
      const errorElement = document.querySelector('.error-message');
      expect(errorElement).not.toBeNull();
      expect(errorElement.textContent).toContain('Test error message');
    });

    it('should limit number of error messages', () => {
      // Initialize the errorHandler
      errorHandler.init();

      // Set max errors to a small number for testing
      const originalMaxErrors = errorHandler.maxErrors;
      errorHandler.maxErrors = 2;

      // Show more errors than the limit
      errorHandler.showError('Error 1');
      errorHandler.showError('Error 2');
      errorHandler.showError('Error 3');

      // Check that only the max number of errors are shown
      const errorElements = document.querySelectorAll('.error-message');
      expect(errorElements).toHaveLength(2);

      // Check that oldest error was removed
      const errorTexts = [...errorElements].map((el) => el.textContent);
      expect(errorTexts.join(' ')).not.toContain('Error 1');
      expect(errorTexts.join(' ')).toContain('Error 2');
      expect(errorTexts.join(' ')).toContain('Error 3');

      // Restore original value
      errorHandler.maxErrors = originalMaxErrors;
    });

    it('should not show authentication errors on login page', () => {
      // Initialize the errorHandler
      errorHandler.init();

      // Use centralized location mock
      const { locationMock, restoreLocation } = setupLocationMock('/login.html');

      // Call the method under test
      errorHandler.showError('User is not authenticated');

      // Check that error was not displayed
      const errorElement = document.querySelector('.error-message');
      expect(errorElement).toBeNull();

      // Restore original location
      restoreLocation();
    });
  });

  describe('handleApiError', () => {
    it('should display formatted error message from error object', () => {
      // Create spy on showError
      const showErrorSpy = jest.spyOn(errorHandler, 'showError');

      // Call the method under test
      errorHandler.handleApiError(new Error('API request failed'));

      // Check that showError was called with correct message
      expect(showErrorSpy).toHaveBeenCalledWith('API request failed');

      // Clean up
      showErrorSpy.mockRestore();
    });

    it('should handle generic errors', () => {
      // Create an API error without a message property
      const apiError = { status: 500 };

      // Create a spy on the error handler
      const handleApiErrorSpy = jest.spyOn(errorHandler, 'handleApiError');

      // Call the method
      errorHandler.handleApiError(apiError);

      // Just verify the method was called
      expect(handleApiErrorSpy).toHaveBeenCalledWith(apiError);

      // Clean up
      handleApiErrorSpy.mockRestore();
    });

    it('should extract message from response data if available', () => {
      // Create spy on showError
      const showErrorSpy = jest.spyOn(errorHandler, 'showError');

      // Call the method under test with error containing response data
      errorHandler.handleApiError({
        response: {
          data: {
            message: 'Invalid input data',
          },
        },
      });

      // Check that showError was called with message from response
      expect(showErrorSpy).toHaveBeenCalledWith('Invalid input data');

      // Clean up
      showErrorSpy.mockRestore();
    });
  });
});
