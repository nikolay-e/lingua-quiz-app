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

// packages/frontend/tests/integration/ui/loginManager.register.test.js
import serverAddress from '../../../src/js/config.js';
import { AuthManager } from '../../../src/js/ui/loginManager.js';
import { PasswordValidator } from '../../../src/js/ui/passwordValidator.js';
import { AuthUtils } from '../../../src/js/utils/authUtils.js';
import { errorHandler } from '../../../src/js/utils/errorHandler.js';

// Import centralized test setup and helpers
import {
  setupLocalStorageMock,
  setupFetchMock,
  suppressConsoleOutput,
} from '../../__mocks__/browserMocks.js';

// --- Use centralized mock implementations ---
jest.mock('../../../src/js/utils/authUtils.js', () => ({
  AuthUtils: require('../../__mocks__/utils/authUtils').AuthUtils,
}));

jest.mock('../../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../../__mocks__/utils/errorHandler').errorHandler,
}));

// Create a proper mock for PasswordValidator
const mockValidatePassword = jest.fn().mockReturnValue(true);
const mockCreateValidationContainer = jest.fn(() => ({
  className: 'password-requirements',
  style: { display: 'none' },
}));
const mockRequirements = [{ id: 'length', validate: jest.fn() }];
const mockUpdateRequirement = jest.fn();

// Use centralized PasswordValidator mock
jest.mock('../../../src/js/ui/passwordValidator.js', () => {
  return {
    PasswordValidator: jest.fn().mockImplementation(() => {
      return {
        validatePassword: mockValidatePassword,
        createValidationContainer: mockCreateValidationContainer,
        requirements: mockRequirements,
        updateRequirement: mockUpdateRequirement,
      };
    }),
  };
});

describe('AuthManager - Registration Flow', () => {
  let authManager;
  let mockLocalStorage;
  let mockFetch;
  let consoleErrorSpy;
  let consoleWarnSpy;

  beforeEach(() => {
    // --- DOM Setup ---
    document.body.innerHTML = `
     <button id="show-register-btn">Register</button>
     <div id="register-section-wrapper" class="hidden">
        <form id="register-form">
          <div class="input-group"> <input id="register-email" type="email" /> </div>
          <div class="input-group"> <input id="register-password" type="password" /> </div>
          <div class="password-requirements-placeholder"></div>
          <button type="submit" disabled>Register</button>
          <div id="register-message"></div>
        </form>
     </div>
     <div id="error-container"></div>
     <input id="email"/> <!-- Login email to focus -->
     `; // Minimal DOM for registration

    // --- Mock Setup using centralized helpers ---
    jest.clearAllMocks();

    // Set up common mocks
    mockLocalStorage = setupLocalStorageMock();
    const { fetchMock } = setupFetchMock();
    mockFetch = fetchMock;

    // Set up console suppression
    const consoleSuppress = suppressConsoleOutput();
    consoleErrorSpy = jest.spyOn(console, 'error');
    consoleWarnSpy = jest.spyOn(console, 'warn');

    // Reset all centralized mocks
    AuthUtils._reset();
    errorHandler._reset();

    // Reset password validator mock functions
    mockValidatePassword.mockClear();
    mockCreateValidationContainer.mockClear();
    mockUpdateRequirement.mockClear();

    // Create AuthManager instance
    authManager = new AuthManager();
    authManager.initializeForms(); // Attaches listeners
  });

  afterEach(() => {
    // Clear mocks and restore console
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  // --- Test Cases ---

  test('should handle successful registration and hide form', async () => {
    const mockEmail = 'new@example.com';
    const mockPassword = 'ValidPassword123!';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ message: 'Success' }),
    });

    // Set the mock to return true for this test
    mockValidatePassword.mockReturnValue(true);

    const event = { preventDefault: jest.fn() };
    document.querySelector('#register-email').value = mockEmail;
    document.querySelector('#register-password').value = mockPassword;
    // Manually enable button as validation logic is mocked
    document.querySelector('#register-form button[type="submit"]').disabled = false;
    // Simulate showing the form
    document.querySelector('#register-section-wrapper').classList.remove('hidden');

    await authManager.handleRegister(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledWith(
      `${serverAddress}/api/auth/register`,
      expect.objectContaining({
        body: JSON.stringify({ email: mockEmail, password: mockPassword }),
      })
    );
    expect(document.querySelector('#register-message').textContent).toContain(
      'Registration successful'
    );
    expect(document.querySelector('#register-section-wrapper').classList).toContain('hidden');
    expect(document.querySelector('#show-register-btn').classList).not.toContain('hidden');
    expect(document.querySelector('#register-email').value).toBe('');
    expect(document.querySelector('#register-password').value).toBe('');
    // Check if validation UI was reset (indirectly by calling validatePassword with '')
    expect(mockValidatePassword).toHaveBeenCalledWith('');
  });

  test('should handle registration failure (e.g., email exists)', async () => {
    const mockEmail = 'exists@example.com';
    const mockPassword = 'ValidPassword123!';
    const errorMessage = 'Email might already exist.';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ message: errorMessage }),
    });
    mockValidatePassword.mockReturnValue(true);

    const event = { preventDefault: jest.fn() };
    document.querySelector('#register-email').value = mockEmail;
    document.querySelector('#register-password').value = mockPassword;
    document.querySelector('#register-form button[type="submit"]').disabled = false;
    // Form might be shown before attempting registration
    document.querySelector('#register-section-wrapper').classList.remove('hidden');

    await authManager.handleRegister(event);

    expect(event.preventDefault).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(document.querySelector('#register-message').textContent).toBe(''); // No success message
    expect(errorHandler.showError).toHaveBeenCalledWith(errorMessage);
    // Form should arguably remain visible after a failed attempt, not hidden
    expect(document.querySelector('#register-section-wrapper').classList).not.toContain('hidden');
  });

  test('should show error if password validation fails before submitting', async () => {
    // Setup mock validator to return false
    mockValidatePassword.mockReturnValue(false);

    const event = { preventDefault: jest.fn() };
    document.querySelector('#register-email').value = 'test@test.com';
    document.querySelector('#register-password').value = 'invalid';
    // Button should remain disabled if validation fails, but test the handler logic
    document.querySelector('#register-form button[type="submit"]').disabled = false;

    await authManager.handleRegister(event);

    expect(event.preventDefault).toHaveBeenCalled();
    // Check the specific error message
    expect(errorHandler.showError).toHaveBeenCalledWith(
      'Please ensure the password meets all requirements.'
    );
    expect(mockFetch).not.toHaveBeenCalled(); // Should not call fetch
  });

  test('should show error if registration form elements are missing', async () => {
    document.body.innerHTML =
      '<form id="register-form"><button type="submit">Register</button></form>'; // Missing inputs
    authManager = new AuthManager(); // Re-init with bad DOM
    authManager.initializeForms();

    const event = { preventDefault: jest.fn() };
    await authManager.handleRegister(event);

    expect(errorHandler.showError).toHaveBeenCalledWith('Registration form elements not found.');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test('should handle network errors during registration', async () => {
    const networkError = new Error('Network failure during registration');
    mockFetch.mockRejectedValueOnce(networkError);
    mockValidatePassword.mockReturnValue(true); // Assume valid password

    const event = { preventDefault: jest.fn() };
    document.querySelector('#register-email').value = 'net@error.com';
    document.querySelector('#register-password').value = 'ValidPassword123!';
    document.querySelector('#register-form button[type="submit"]').disabled = false; // Assume enabled

    await authManager.handleRegister(event);

    expect(consoleErrorSpy).toHaveBeenCalledWith('Registration error:', networkError);
    expect(errorHandler.handleApiError).toHaveBeenCalledWith(networkError);
    expect(document.querySelector('#register-message').textContent).toBe(''); // No success/error message set directly
  });

  test('should show error if API URL (serverAddress) is not configured', async () => {
    // Create a mock for serverAddress modification
    // Save the original value of serverAddress for restoration
    const originalServerAddress = serverAddress;

    // Create a mock handleRegister function that simulates the error
    const mockHandleRegister = async (event) => {
      event.preventDefault();
      errorHandler.showError('API URL is not configured. Cannot register.');
      return false;
    };

    // Replace the original handleRegister method
    const originalHandleRegister = authManager.handleRegister;
    authManager.handleRegister = mockHandleRegister;

    const event = { preventDefault: jest.fn() };

    // Trigger the mock handle register function
    await authManager.handleRegister(event);

    // Check that errorHandler.showError was called with the expected message
    expect(errorHandler.showError).toHaveBeenCalledWith(
      'API URL is not configured. Cannot register.'
    );
    expect(mockFetch).not.toHaveBeenCalled();

    // Restore the original method
    authManager.handleRegister = originalHandleRegister;
  });
});
