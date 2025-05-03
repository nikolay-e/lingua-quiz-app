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

// packages/e2e-tests/page-objects/login-page.js
import { expect } from '@playwright/test';

import { handleLogin, handleLogout } from './auth/login-form-handlers.js';
import { clearStorageAndCookies, takeErrorScreenshot } from './auth/login-helpers.js';
import { showRegistrationForm, handleRegistration } from './auth/register-form-handlers.js';
import BasePage from './base-page';

/**
 * Page object for login/authentication functionality
 */
class LoginPage extends BasePage {
  constructor(page) {
    super(page);

    // Define selectors once for reuse
    this.selectors = {
      // Login form elements
      loginForm: '#login-form',
      emailInput: '#email',
      passwordInput: '#password',
      loginButton: '#login-form button[type="submit"]',
      errorMessage: '#error-container .error-message, #login-message:not(:empty)',

      // Registration elements
      showRegisterButton: '#show-register-btn',
      registerSection: '#register-section-wrapper',
      registerEmailInput: '#register-email',
      registerPasswordInput: '#register-password',
      registerButton: '#register-form button[type="submit"]',
      registerMessage: '#register-message',

      // Logged in state elements
      logoutButton: '#login-logout-btn',
      deleteAccountButton: '#delete-account-btn',
    };
  }

  /**
   * Navigate to login page
   */
  async navigate() {
    await this.page.goto('/login.html', { waitUntil: 'domcontentloaded' });
    await this.waitForElement(this.selectors.loginForm, {
      errorMessage: 'Login form not visible after navigation',
    });
    await this.log('Navigated to login page');
  }

  /**
   * Clear local storage and cookies
   */
  async clearStorageAndCookies() {
    await clearStorageAndCookies(this.page, this.log.bind(this));
  }

  /**
   * Login with provided credentials
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>} True if login successful
   */
  async login(email, password) {
    return await handleLogin(
      this.page,
      this.selectors,
      {
        waitForElement: this.waitForElement.bind(this),
        fillInput: this.fillInput.bind(this),
        getText: this.getText.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.log.bind(this),
      email,
      password
    );
  }

  /**
   * Show the registration form
   */
  async showRegistrationForm() {
    return await showRegistrationForm(
      this.page,
      this.selectors,
      {
        waitForElement: this.waitForElement.bind(this),
        fillInput: this.fillInput.bind(this),
        getText: this.getText.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.log.bind(this)
    );
  }

  /**
   * Register a new user
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>} True if registration successful
   */
  async register(email, password) {
    return await handleRegistration(
      this.page,
      this.selectors,
      {
        waitForElement: this.waitForElement.bind(this),
        fillInput: this.fillInput.bind(this),
        getText: this.getText.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.log.bind(this),
      email,
      password
    );
  }

  /**
   * Logout the current user
   */
  async logout() {
    return await handleLogout(
      this.page,
      this.selectors,
      {
        waitForElement: this.waitForElement.bind(this),
        fillInput: this.fillInput.bind(this),
        getText: this.getText.bind(this),
        clickElement: this.clickElement.bind(this),
      },
      this.timeouts,
      this.log.bind(this)
    );
  }

  /**
   * Delete the current user account
   */
  async deleteAccount() {
    await this.log('Attempting to delete account', 'info');

    try {
      // Handle the confirmation dialog
      this.page.once('dialog', async (dialog) => {
        await this.log(`Accepting dialog: ${dialog.message()}`, 'info');
        await dialog.accept();
      });

      await this.clickElement(this.selectors.deleteAccountButton);

      // Wait for redirection to login page
      await this.page.waitForURL('**/login.html', {
        waitUntil: 'networkidle',
        timeout: this.timeouts.long, // Increased timeout for backend processing
      });

      // Verify login form is visible
      await this.waitForElement(this.selectors.loginForm, {
        errorMessage: 'Login form not visible after account deletion',
      });

      await this.log('Account deletion successful', 'info');
      return true;
    } catch (error) {
      await this.log(`Account deletion error: ${error.message}`, 'error');
      await takeErrorScreenshot(this.page, 'account_deletion_error', this.log.bind(this));
      return false;
    }
  }

  /**
   * Ensures a user is registered before a test
   * @param {string} email
   * @param {string} password
   * @returns {Promise<boolean>} True if user exists or was successfully registered
   */
  async ensureUserRegistered(email, password) {
    await this.navigate();

    // Try login first to see if user exists
    const loginSuccess = await this.login(email, password);

    if (loginSuccess) {
      // User exists, logout to return to initial state
      await this.logout();
      return true;
    }

    // User doesn't exist, register
    return await this.register(email, password);
  }
}

export default LoginPage;
