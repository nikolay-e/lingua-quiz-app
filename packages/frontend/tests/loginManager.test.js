import jwtDecode from 'jwt-decode';
import { AuthManager } from '../src/js/ui/loginManager.js';

// Mock the jwt-decode module
jest.mock('jwt-decode', () => jest.fn());

describe('AuthManager Class', () => {
  let authManager;

  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = `
      <form id="login-form">
        <input id="email" />
        <input id="password" />
        <button type="submit"></button>
      </form>
      <form id="register-form">
        <input id="register-email" />
        <input id="register-password" />
        <button type="submit"></button>
      </form>
      <button id="login-logout-btn"></button>
      <div id="login-message"></div>
      <div id="register-message"></div>
    `;
    authManager = new AuthManager();
    jwtDecode.mockClear();
  });

  it('should initialize forms', () => {
    authManager.initializeForms();
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    expect(loginForm).not.toBeNull();
    expect(registerForm).not.toBeNull();
  });

  it('should handle login success', async () => {
    // Mock the fetch response for successful login
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ token: 'fake-jwt-token' }),
      })
    );

    // Mock the decoded token
    jwtDecode.mockReturnValue({ exp: Date.now() + 1000 * 60 * 60 }); // 1 hour in the future

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    emailInput.value = 'test@example.com';
    passwordInput.value = 'password';

    authManager.initializeForms();

    const event = new Event('submit');
    loginForm.dispatchEvent(event);

    // Wait for all promises to resolve
    await Promise.resolve();
    await Promise.resolve();

    expect(localStorage.getItem('token')).toBe('fake-jwt-token');
    expect(localStorage.getItem('email')).toBe('test@example.com');
    expect(jwtDecode).toHaveBeenCalledWith('fake-jwt-token');
    expect(localStorage.getItem('tokenExpiration')).toBe(String(Date.now() + 1000 * 60 * 60));
    expect(loginMessage.textContent).toContain('Login successful');
  });

  it('should handle login failure', async () => {
    // Mock the fetch response for failed login
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ message: 'Invalid credentials' }),
      })
    );

    const loginForm = document.getElementById('login-form');
    const loginMessage = document.getElementById('login-message');

    authManager.initializeForms();

    const event = new Event('submit');
    loginForm.dispatchEvent(event);

    // Wait for all promises to resolve
    await Promise.resolve();

    expect(localStorage.getItem('token')).toBeNull();
    expect(localStorage.getItem('email')).toBeNull();
    expect(loginMessage.textContent).toContain('Invalid credentials');
  });
});
