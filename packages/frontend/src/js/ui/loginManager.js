import serverAddress from '../config.js';
import { AuthUtils } from '../utils/authUtils.js';
import { errorHandler } from '../utils/errorHandler.js';

// Force frontend rebuild - version 2.0

import { populateWordSets } from './eventHandlers.js';
import { PasswordValidator } from './passwordValidator.js';

export class AuthManager {
  constructor() {
    this.token = AuthUtils.getToken();
    this.email = localStorage.getItem(AuthUtils.EMAIL_KEY);
    this.passwordValidator = new PasswordValidator();
  }

  isAuthenticated() {
    return AuthUtils.isValidToken(this.token);
  }

  // eslint-disable-next-line
  redirectToLogin() {
    AuthUtils.redirectToLogin();
  }

  logout() {
    // First clear the auth
    AuthUtils.clearAuth();

    // Force immediate check and redirect
    AuthUtils.shouldRedirectToLogin();

    // Update UI
    this.updateLoginStatus();

    // Use replace instead of href to prevent back navigation
    window.location.replace('login.html');
  }

  // eslint-disable-next-line class-methods-use-this
  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginMessage = document.getElementById('login-message');

    try {
      const response = await fetch(`${serverAddress}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        AuthUtils.setToken(data.token);
        AuthUtils.setEmail(email);
        loginMessage.textContent = 'Login successful. Loading word sets...';
        try {
          window.location.replace('/');
          await populateWordSets();
        } catch (error) {
          console.error('Error loading word sets:', error);
          errorHandler.handleApiError(error);
        }
      } else {
        errorHandler.showError(data.message || 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      errorHandler.handleApiError(error);
    }
  }

  updateLoginStatus() {
    const loginLogoutBtn = document.getElementById('login-logout-btn');
    this.token = AuthUtils.getToken();
    this.email = localStorage.getItem(AuthUtils.EMAIL_KEY);

    if (loginLogoutBtn) {
      if (this.isAuthenticated()) {
        loginLogoutBtn.innerHTML = `
          <i class="fas fa-sign-out-alt"></i> 
          <span>Logout (${this.email})</span>
        `;
        loginLogoutBtn.removeEventListener('click', this.redirectToLogin);
        loginLogoutBtn.addEventListener('click', this.logout.bind(this));
      } else {
        loginLogoutBtn.innerHTML = `
          <i class="fas fa-sign-in-alt"></i> 
          <span>Login</span>
        `;
        loginLogoutBtn.removeEventListener('click', this.logout);
        if (!window.location.pathname.includes('login.html')) {
          loginLogoutBtn.addEventListener('click', this.redirectToLogin);
        }
      }
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const registerMessage = document.getElementById('register-message');

    if (!this.passwordValidator.validatePassword(password)) {
      errorHandler.showError('Please meet all password requirements');
      return;
    }

    try {
      const response = await fetch(`${serverAddress}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        registerMessage.textContent = 'Registration successful. You can now log in.';
        registerMessage.style.color = 'var(--success-color)';
        // Clear the form
        document.getElementById('register-email').value = '';
        document.getElementById('register-password').value = '';
        // Reset password validation display
        this.passwordValidator.validatePassword('');
      } else {
        console.warn(`Registration failed: ${data.message || 'Registration failed'}`);
        errorHandler.showError(data.message || 'Registration failed. Please try again.');
      }
    } catch (error) {
      console.error('Registration error:', error);
      errorHandler.handleApiError(error);
    }
  }

  initializePasswordValidation(passwordInput, registerForm) {
    const validationContainer = this.passwordValidator.createValidationContainer();
    passwordInput.parentNode.insertBefore(validationContainer, passwordInput.nextSibling);

    // Add show/hide password toggle
    const togglePasswordBtn = document.createElement('button');
    togglePasswordBtn.type = 'button';
    togglePasswordBtn.className = 'toggle-password-btn';
    togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      // eslint-disable-next-line no-param-reassign
      passwordInput.type = type;
      // eslint-disable-next-line max-len
      togglePasswordBtn.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
    });
    passwordInput.parentNode.appendChild(togglePasswordBtn);

    // Add real-time validation
    passwordInput.addEventListener('input', (e) => {
      const isValid = this.passwordValidator.validatePassword(e.target.value);
      const submitButton = registerForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = !isValid;
      }
    });

    // Show validation on focus
    passwordInput.addEventListener('focus', () => {
      validationContainer.style.display = 'block';
    });
  }

  initializeForms() {
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      const passwordInput = document.getElementById('register-password');
      if (passwordInput) {
        this.initializePasswordValidation(passwordInput, registerForm);
      }
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    // Initialize login toggle buttons
    const loginToggleBtns = document.querySelectorAll('.toggle-password-btn');
    loginToggleBtns.forEach((btn) => {
      const input = btn.previousElementSibling;
      if (input) {
        btn.addEventListener('click', () => {
          const type = input.type === 'password' ? 'text' : 'password';
          input.type = type;
          // eslint-disable-next-line no-param-reassign
          btn.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
        });
      }
    });
  }

  checkAuthAndRedirect() {
    if (AuthUtils.shouldRedirectToLogin()) {
      this.redirectToLogin();
    }
  }
}

export function initAuth() {
  errorHandler.init();
  const authManager = new AuthManager();
  authManager.initializeForms();
  authManager.updateLoginStatus();
  authManager.checkAuthAndRedirect();
  AuthUtils.initAuthCheck();
}
