// packages/frontend/tests/integration/auth-flow.test.js
import { AuthManager } from '../../src/js/ui/loginManager.js';
import { 
  errorHandler, 
  AuthUtils, 
  fetchMock,
  createMockToken, 
  setupAuthState,
  setupAuthTestDOM 
} from '../../__mocks__/integrationTestSetup.js';

describe('Auth Flow Integration', () => {
  let authManager;
  
  beforeEach(() => {
    // Set up test DOM
    setupAuthTestDOM();
    
    // Create auth manager instance
    authManager = new AuthManager();
    authManager.initializeForms();
  });
  
  describe('Complete Auth Flow Integration', () => {
    it('should handle full login-storage-logout flow', async () => {
      // STEP 1: Set up valid API response for login
      const mockEmail = 'test@example.com';
      const mockPassword = 'password123';
      const mockToken = createMockToken({ email: mockEmail });
      
      fetchMock.mockResponseOnce(JSON.stringify({ token: mockToken }), { status: 200 });
      
      // Set up form values
      document.querySelector('#email').value = mockEmail;
      document.querySelector('#password').value = mockPassword;
      const event = { preventDefault: jest.fn() };
      
      // STEP 2: Execute login flow
      await authManager.handleLogin(event);
      
      // Verify API was called correctly
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:9000/api/auth/login',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: mockEmail, password: mockPassword }),
        })
      );
      
      // Verify local storage was updated
      expect(localStorage.getItem(AuthUtils.TOKEN_KEY)).toBe(mockToken);
      expect(localStorage.getItem(AuthUtils.EMAIL_KEY)).toBe(mockEmail);
      
      // Verify UI was updated with success message
      expect(document.querySelector('#login-message').textContent).toContain('Login successful');
      
      // STEP 3: Check authentication state
      // Re-create auth manager to simulate page refresh/component remount
      authManager = new AuthManager();
      authManager.updateLoginStatus();
      
      // Verify login button now shows as logout
      const loginButton = document.querySelector('#login-logout-btn');
      expect(loginButton.textContent).toContain('Logout');
      expect(loginButton.textContent).toContain(mockEmail);
      
      // STEP 4: Perform logout
      authManager.logout();
      
      // Verify local storage was cleared
      expect(localStorage.getItem(AuthUtils.TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(AuthUtils.EMAIL_KEY)).toBeNull();
      
      // Verify redirect was attempted (mock will just set the href)
      expect(window.location.href).toBe('/login.html');
    });
    
    it('should handle login failure with proper error display', async () => {
      // Arrange
      const mockEmail = 'test@example.com';
      const mockPassword = 'wrong-password';
      const errorMessage = 'Invalid credentials';
      
      fetchMock.mockResponseOnce(
        JSON.stringify({ message: errorMessage }), 
        { status: 401 }
      );
      
      // Set form values
      document.querySelector('#email').value = mockEmail;
      document.querySelector('#password').value = mockPassword;
      const event = { preventDefault: jest.fn() };
      
      // Act
      await authManager.handleLogin(event);
      
      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      
      // Verify localStorage does NOT have token
      expect(localStorage.getItem(AuthUtils.TOKEN_KEY)).toBeNull();
      
      // Verify error was shown to user
      expect(document.querySelector('#login-message').textContent).toContain(errorMessage);
      expect(errorHandler.showError).toHaveBeenCalledWith(errorMessage);
      
      // Verify login button still shows "Login" (not "Logout")
      expect(document.querySelector('#login-logout-btn').textContent).toContain('Login');
    });
    
    it('should detect expired token and redirect to login', () => {
      // Arrange - Create expired token in localStorage
      const expiredToken = createMockToken({}, -3600); // Expired 1 hour ago
      localStorage.setItem(AuthUtils.TOKEN_KEY, expiredToken);
      localStorage.setItem(AuthUtils.EMAIL_KEY, 'test@example.com');
      
      // Simulate page outside login
      window.location.pathname = '/dashboard';
      
      // Act
      authManager.checkAuthAndRedirect();
      
      // Assert
      // Token should be cleared
      expect(localStorage.getItem(AuthUtils.TOKEN_KEY)).toBeNull();
      expect(localStorage.getItem(AuthUtils.EMAIL_KEY)).toBeNull();
      
      // Should be redirected to login page
      expect(window.location.href).toBe('/login.html');
    });
    
    it('should respond to localStorage token changes when updating UI', () => {
      // STEP 1: Start with no token
      localStorage.clear();
      authManager.updateLoginStatus();
      
      // Verify login button shows "Login"
      let loginButton = document.querySelector('#login-logout-btn');
      expect(loginButton.textContent).toContain('Login');
      
      // STEP 2: Set valid token in localStorage
      const validToken = createMockToken();
      const testEmail = 'test@example.com';
      localStorage.setItem(AuthUtils.TOKEN_KEY, validToken);
      localStorage.setItem(AuthUtils.EMAIL_KEY, testEmail);
      
      // Update UI
      authManager.updateLoginStatus();
      
      // Verify login button now shows "Logout" with email
      loginButton = document.querySelector('#login-logout-btn');
      expect(loginButton.textContent).toContain('Logout');
      expect(loginButton.textContent).toContain(testEmail);
      
      // STEP 3: Simulate token cleared by another component
      localStorage.clear();
      
      // Update UI again
      authManager.updateLoginStatus();
      
      // Verify login button shows "Login" again
      loginButton = document.querySelector('#login-logout-btn');
      expect(loginButton.textContent).toContain('Login');
    });
    
    it('should prevent redirect loop when on login page with invalid token', () => {
      // Arrange - Create expired token in localStorage
      const expiredToken = createMockToken({}, -3600); // Expired 1 hour ago
      localStorage.setItem(AuthUtils.TOKEN_KEY, expiredToken);
      
      // Set location to login page
      window.location.pathname = '/login.html';
      
      // Spy on window.location.replace
      const replaceSpy = jest.spyOn(window.location, 'replace');
      
      // Act
      authManager.checkAuthAndRedirect();
      
      // Assert
      // Token should still be cleared
      expect(localStorage.getItem(AuthUtils.TOKEN_KEY)).toBeNull();
      
      // Should NOT redirect again (would cause loop)
      expect(replaceSpy).not.toHaveBeenCalled();
    });
  });
});