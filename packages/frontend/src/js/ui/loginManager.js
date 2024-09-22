/* eslint-disable class-methods-use-this */
import jwtDecode from 'jwt-decode';
import serverAddress from '../config.js';
import { populateWordLists } from './eventHandlers.js';

export class AuthManager {
  constructor() {
    this.token = localStorage.getItem('token');
    this.email = localStorage.getItem('email');
  }

  isAuthenticated() {
    return !!this.token;
  }

  redirectToLogin() {
    window.location.href = '/login.html';
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('email');
    this.updateLoginStatus();
    window.location.href = 'login.html';
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const loginMessage = document.getElementById('login-message');

    try {
      const response = await fetch(`${serverAddress}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('email', email);
        try {
          const decodedToken = jwtDecode(data.token);
          localStorage.setItem('tokenExpiration', decodedToken.exp * 1000);
        } catch (error) {
          console.error('Error decoding token:', error);
        }
        loginMessage.textContent = 'Login successful. Loading word lists...';
        try {
          window.location.href = '/';
          await populateWordLists();
        } catch (error) {
          console.error('Error loading word lists:', error);
          loginMessage.textContent =
            'Login successful, but failed to load word lists. Please refresh the page.';
        }
      } else {
        loginMessage.textContent = data.message || 'Invalid credentials';
      }
    } catch (error) {
      console.error('Login error:', error);
      loginMessage.textContent = `An error occurred: ${error.message}. Please try again.`;
    }
  }

  updateLoginStatus() {
    const loginLogoutBtn = document.getElementById('login-logout-btn');
    this.token = localStorage.getItem('token');
    this.email = localStorage.getItem('email');

    if (loginLogoutBtn) {
      if (this.token && this.email) {
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

    try {
      const response = await fetch(`${serverAddress}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok) {
        registerMessage.textContent = 'Registration successful. You can now log in.';
      } else {
        console.warn(`Registration failed: ${data.message || 'Registration failed'}`);
        registerMessage.textContent = data.message || 'Registration failed. Please try again.';
      }
    } catch (error) {
      console.error('Registration error:', error);
      registerMessage.textContent = `An error occurred: ${error.message}. Please try again.`;
    }
  }

  initializeForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
    }

    const registerForm = document.getElementById('register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
    }
  }

  checkAuthAndRedirect() {
    if (!this.isAuthenticated() && window.location.pathname !== '/login.html') {
      this.redirectToLogin();
    }
  }
}

export function initAuth() {
  const authManager = new AuthManager();
  authManager.initializeForms();
  authManager.updateLoginStatus();
  authManager.checkAuthAndRedirect();
}
