import { AuthManager } from '../../../src/js/ui/loginManager.js';
import { PasswordValidator } from '../../../src/js/ui/passwordValidator.js';
import { AuthUtils } from '../../../src/js/utils/authUtils.js';
import { errorHandler } from '../../../src/js/utils/errorHandler.js';

// Import centralized test setup and helpers
import { 
  setupLocalStorageMock, 
  setupFetchMock, 
  suppressConsoleOutput 
} from '../../__mocks__/browserMocks.js';

// --- Use centralized mock implementations ---
jest.mock('../../../src/js/utils/authUtils.js', () => ({
  AuthUtils: require('../../__mocks__/utils/authUtils').AuthUtils,
}));

jest.mock('../../../src/js/utils/errorHandler.js', () => ({
  errorHandler: require('../../__mocks__/utils/errorHandler').errorHandler,
}));

// Create mock functions to track calls
const mockValidatePassword = jest.fn().mockReturnValue(true);
const mockCreateValidationContainer = jest.fn(() => ({
  className: 'password-requirements',
  style: { display: 'none' },
  innerHTML: '',
  // Add mock requirement elements needed by updateRequirement
  querySelector: jest.fn().mockImplementation((selector) => {
    if (selector.includes('length')) return { className: '', querySelector: jest.fn() };
    if (selector.includes('uppercase')) return { className: '', querySelector: jest.fn() };
    return null;
  }),
}));
const mockRequirements = [
  // Provide mock requirements array
  { id: 'length', validate: jest.fn(), label: 'Length' },
  { id: 'uppercase', validate: jest.fn(), label: 'Uppercase' },
  // Add others if needed
];
const mockUpdateRequirement = jest.fn();

// Use centralized PasswordValidator mock with custom implementation for UI tests
jest.mock('../../../src/js/ui/passwordValidator.js', () => ({
  PasswordValidator: jest.fn().mockImplementation(() => ({
    validatePassword: mockValidatePassword,
    createValidationContainer: mockCreateValidationContainer,
    requirements: mockRequirements,
    updateRequirement: mockUpdateRequirement,
  })),
}));

describe('AuthManager - UI Interaction & Initialization', () => {
  let authManager;
  let mockLocalStorage;
  let consoleErrorSpy;

  beforeEach(() => {
    // --- DOM Setup (More complete for UI tests) ---
    document.body.innerHTML = `
      <div id="user-status">
         <div class="user-actions">
             <button id="login-logout-btn">Login</button>
             <button id="delete-account-btn" style="display: none;">Delete</button>
          </div>
      </div>
      <form id="login-form">
        <div class="input-group"> <input id="email" type="email" /> </div>
        <div class="input-group"> <input id="password" type="password" /> </div>
        <div id="login-message"></div> <button type="submit">Login</button>
      </form>
       <button id="show-register-btn">Register</button>
       <div id="register-section-wrapper" class="hidden">
          <form id="register-form">
            <div class="input-group"> <input id="register-email" type="email" /> </div>
            <div class="input-group"> <input id="register-password" type="password" /> </div>
            <!-- Placeholder where validation UI would be inserted -->
            <button type="submit" disabled>Register</button>
            <div id="register-message"></div>
          </form>
       </div>
       <div id="error-container"></div>
    `;

    // --- Mock Setup using centralized helpers ---
    jest.clearAllMocks();
    
    // Set up common mocks
    mockLocalStorage = setupLocalStorageMock();
    const { fetchMock } = setupFetchMock();
    
    // Set up console suppression
    const consoleSuppress = suppressConsoleOutput();
    consoleErrorSpy = jest.spyOn(console, 'error');
    
    // Reset all centralized mocks
    AuthUtils._reset();
    errorHandler._reset();
    
    // Clear all password validator mock functions
    mockValidatePassword.mockClear();
    mockCreateValidationContainer.mockClear();
    mockUpdateRequirement.mockClear();

    // --- Instance Creation & Initialization ---
    authManager = new AuthManager();
    authManager.initializeForms(); // This attaches listeners and calls initializePasswordValidation
  });

  afterEach(() => {
    // Clear mocks
    mockLocalStorage.clear();
    jest.clearAllMocks();
  });

  // --- Test Cases ---

  describe('UI Updates', () => {
    test('should update login/delete buttons for authenticated user', () => {
      const testEmail = 'user@example.com';
      AuthUtils.isValidToken.mockReturnValue(true);
      AuthUtils.getToken.mockReturnValue('fake-token');
      // Mock localStorage getItem directly for this test
      mockLocalStorage.getItem.mockImplementation((key) =>
        key === AuthUtils.EMAIL_KEY ? testEmail : key === AuthUtils.TOKEN_KEY ? 'fake-token' : null
      );

      authManager.updateLoginStatus();

      const loginButton = document.querySelector('#login-logout-btn');
      const deleteButton = document.querySelector('#delete-account-btn');

      expect(loginButton.textContent).toContain('Logout');
      expect(loginButton.textContent).toContain(testEmail);
      expect(deleteButton.style.display).toBe('inline-block'); // Check style directly
    });

    test('should update login/delete buttons for unauthenticated user', () => {
      AuthUtils.isValidToken.mockReturnValue(false);
      AuthUtils.getToken.mockReturnValue(null);
      mockLocalStorage.getItem.mockReturnValue(null); // Ensure email is also null

      authManager.updateLoginStatus();

      const loginButton = document.querySelector('#login-logout-btn');
      const deleteButton = document.querySelector('#delete-account-btn');

      expect(loginButton.textContent).toContain('Login');
      expect(deleteButton.style.display).toBe('none'); // Check style directly
    });
  });

  describe('Password Visibility Toggle', () => {
    test('should toggle input type and button icon for login password', () => {
      const passwordInput = document.querySelector('#password');
      const toggleButton = passwordInput
        .closest('.input-group')
        .querySelector('.toggle-password-btn'); // Find relative to input

      expect(toggleButton).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(toggleButton.innerHTML).toContain('fa-eye');

      const toggleSpy = jest.spyOn(authManager, 'togglePasswordVisibility');
      toggleButton.click();

      expect(toggleSpy).toHaveBeenCalledWith(passwordInput, toggleButton);
      expect(passwordInput.type).toBe('text');
      expect(toggleButton.innerHTML).toContain('fa-eye-slash');

      toggleButton.click();
      expect(toggleSpy).toHaveBeenCalledTimes(2);
      expect(passwordInput.type).toBe('password');
      expect(toggleButton.innerHTML).toContain('fa-eye');
      toggleSpy.mockRestore();
    });

    test('should toggle input type and button icon for register password', () => {
      const passwordInput = document.querySelector('#register-password');
      const toggleButton = passwordInput
        .closest('.input-group')
        .querySelector('.toggle-password-btn');

      expect(toggleButton).toBeTruthy();
      expect(passwordInput.type).toBe('password');
      expect(toggleButton.innerHTML).toContain('fa-eye');

      const toggleSpy = jest.spyOn(authManager, 'togglePasswordVisibility');
      toggleButton.click();

      expect(toggleSpy).toHaveBeenCalledWith(passwordInput, toggleButton);
      expect(passwordInput.type).toBe('text');
      expect(toggleButton.innerHTML).toContain('fa-eye-slash');

      toggleButton.click();
      expect(toggleSpy).toHaveBeenCalledTimes(2);
      expect(passwordInput.type).toBe('password');
      expect(toggleButton.innerHTML).toContain('fa-eye');
      toggleSpy.mockRestore();
    });
  });

  describe('Initialization and DOM Checks', () => {
    test('should initialize forms and set up listeners correctly', () => {
      const loginForm = document.querySelector('#login-form');
      const registerForm = document.querySelector('#register-form');
      const showRegisterBtn = document.querySelector('#show-register-btn');

      // Check if forms exist (verified by beforeEach setup)
      expect(loginForm).toBeTruthy();
      expect(registerForm).toBeTruthy();
      expect(showRegisterBtn).toBeTruthy();

      // Check if password validator interaction happened during init
      expect(mockCreateValidationContainer).toHaveBeenCalledTimes(1);
      // Check if listeners were attached (harder to check directly without spying on addEventListener,
      // but we can infer from other tests passing)
    });

    test('should handle missing user status elements gracefully during update', () => {
      document.body.innerHTML = ''; // No elements
      authManager = new AuthManager(); // Re-init
      // Calling updateLoginStatus should not throw an error
      expect(() => authManager.updateLoginStatus()).not.toThrow();
    });

    test('should handle missing password validation elements gracefully during init', () => {
      // Reset all mocks to clear previous calls
      jest.clearAllMocks();

      // DOM without password input or container placeholder
      document.body.innerHTML = `
                 <form id="register-form">
                    <input id="register-email" type="email" />
                    <button type="submit">Register</button>
                 </form>`;

      // Create a new instance
      const newAuthManager = new AuthManager();

      // Reset mock to clear all previous calls
      mockCreateValidationContainer.mockClear();

      // Call initializeForms with the new DOM setup
      expect(() => newAuthManager.initializeForms()).not.toThrow();

      // Now check if the mock wasn't called in this specific test
      expect(mockCreateValidationContainer).not.toHaveBeenCalled();
    });

    test('should handle missing input group for password toggle gracefully', () => {
      // Reset all mocks to clear previous calls
      jest.clearAllMocks();

      // DOM where password input isn't inside an input-group
      document.body.innerHTML = `
                 <form id="login-form"> <input id="password" type="password" /> </form>
                 <form id="register-form"> <input id="register-password" type="password" /> </form>
                 `;

      // Create a new instance
      const newAuthManager = new AuthManager();

      // initializeForms should run without throwing and log errors
      expect(() => newAuthManager.initializeForms()).not.toThrow();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Could not find parent .input-group for login password input.'
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Could not find parent .input-group for registration password input.'
      );

      // No toggle buttons should have been added
      expect(document.querySelector('.toggle-password-btn')).toBeNull();
    });

    test('should handle click on show register button', () => {
      const showRegisterBtn = document.querySelector('#show-register-btn');
      const registerWrapper = document.querySelector('#register-section-wrapper');
      const registerEmailInput = document.querySelector('#register-email');
      const focusSpy = jest.spyOn(registerEmailInput, 'focus');

      expect(registerWrapper.classList).toContain('hidden');
      expect(showRegisterBtn.classList).not.toContain('hidden');

      showRegisterBtn.click(); // Simulate click

      expect(registerWrapper.classList).not.toContain('hidden');
      expect(showRegisterBtn.classList).toContain('hidden');
      expect(focusSpy).toHaveBeenCalled(); // Check if focus was called

      focusSpy.mockRestore();
    });
  });
});
