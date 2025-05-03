import serverAddress from '../config.js'; // Use the configured server address
import { PasswordValidator } from './passwordValidator.js';
import { AuthUtils } from '../utils/authUtils.js'; // Import the object literal
import { errorHandler } from '../utils/errorHandler.js';

export class AuthManager {
  constructor() {
    this.token = AuthUtils.getToken();
    this.email = localStorage.getItem(AuthUtils.EMAIL_KEY);
    this.passwordValidator = new PasswordValidator();
    this.boundLogout = this.logout.bind(this); // Add this line
    this._passwordToggleHandler = null;
    this._loginPasswordToggleHandler = null;
  }

  isAuthenticated() {
    // This is a simple check that doesn't need the full handling -
    // it's just checking the token without side effects
    return AuthUtils.isValidToken(this.token);
  }

  logout() {
    console.log('Logout method called');
    
    // Store the current state of the button before clearing auth
    const loginButton = document.querySelector('#login-logout-btn');
    const initialText = loginButton ? loginButton.innerHTML : '';

    // Clear authentication data
    AuthUtils.clearAuth(); // Clear token/email from storage
    console.log('Auth data cleared');

    // Update UI immediately
    this.updateLoginStatus();
    console.log('UI updated after logout');

    // Redirect to login page using AuthUtils for consistency
    console.log('About to redirect to login page');
    
    // Use AuthUtils.redirectToLogin() for consistency with other authentication flows
    // This will handle window.location.replace for us
    AuthUtils.redirectToLogin();
    console.log('Redirect command issued');
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.querySelector('#email')?.value;
    const password = document.querySelector('#password')?.value;
    const loginMessage = document.querySelector('#login-message');

    // Check if serverAddress is configured
    if (!serverAddress) {
      errorHandler.showError('API URL is not configured. Cannot log in.');
      return;
    }

    if (!email || !password || !loginMessage) {
      errorHandler.showError('Login form elements not found.');
      return;
    }

    // Clear any attributes from registration
    if (loginMessage.dataset.source) {
      delete loginMessage.dataset.source;
    }

    loginMessage.textContent = 'Logging in...';
    loginMessage.style.color = ''; // Reset color

    try {
      const response = await fetch(`${serverAddress}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (response.ok && data.token) {
        AuthUtils.setToken(data.token);
        AuthUtils.setEmail(email);
        loginMessage.textContent = 'Login successful! Redirecting...';
        loginMessage.style.color = 'var(--success-color)';
        loginMessage.className = 'success-message';
        // Use replace to avoid adding login page to history
        window.location.replace('/');
      } else {
        // Show error in login message area to make it more visible
        loginMessage.textContent = data.message || 'Invalid credentials';
        loginMessage.style.color = '#721c24';
        loginMessage.className = 'error-message';

        // Also use the error handler to show the popup message
        errorHandler.showError(data.message || 'Invalid credentials');
      }
    } catch (error) {
      loginMessage.textContent = ''; // Clear "Logging in..." message
      console.error('Login error:', error);
      errorHandler.handleApiError(error);
    }
  }

  updateLoginStatus() {
    const loginLogoutBtn = document.querySelector('#login-logout-btn');
    const deleteAccountBtn = document.querySelector('#delete-account-btn');

    // Refresh token and email from storage each time status is updated
    this.token = AuthUtils.getToken();
    this.email = localStorage.getItem(AuthUtils.EMAIL_KEY);

    if (loginLogoutBtn) {
      // Clone the button to remove all event listeners
      const newLoginBtn = loginLogoutBtn.cloneNode(true);
      if (loginLogoutBtn.parentNode) {
        loginLogoutBtn.parentNode.replaceChild(newLoginBtn, loginLogoutBtn);
      }

      if (this.isAuthenticated()) {
        newLoginBtn.innerHTML = `
          <i class="fas fa-sign-out-alt"></i>
          <span>Logout (${this.email || 'User'})</span>`;
        // Add only one listener to the new button
        newLoginBtn.addEventListener('click', this.boundLogout);

        if (deleteAccountBtn) {
          deleteAccountBtn.style.display = 'inline-block'; // Show delete button
        }
      } else {
        newLoginBtn.innerHTML = `
          <i class="fas fa-sign-in-alt"></i>
          <span>Login</span>`;

        // Only add redirect listener if *not* already on login page
        if (!window.location.pathname.includes(AuthUtils.LOGIN_PAGE)) {
          newLoginBtn.addEventListener('click', () => {
            window.location.href = AuthUtils.LOGIN_PAGE;
          });
        }

        if (deleteAccountBtn) {
          deleteAccountBtn.style.display = 'none'; // Hide delete button
        }
      }
    }
  }

  async handleRegister(e) {
    e.preventDefault();
    const emailInput = document.querySelector('#register-email');
    const passwordInput = document.querySelector('#register-password');
    const registerMessage = document.querySelector('#register-message');

    // Reset any previous success flag that tests might check
    window.registrationSuccess = false;

    // Check if serverAddress is configured
    if (!serverAddress) {
      errorHandler.showError('API URL is not configured. Cannot register.');
      return false;
    }

    if (!emailInput || !passwordInput || !registerMessage) {
      errorHandler.showError('Registration form elements not found.');
      return false;
    }

    const email = emailInput.value;
    const password = passwordInput.value;

    if (!this.passwordValidator.validatePassword(password)) {
      errorHandler.showError('Please ensure the password meets all requirements.');
      return false;
    }

    registerMessage.textContent = 'Registering...';
    registerMessage.style.color = ''; // Reset color
    // Add data attribute for test detection
    registerMessage.dataset.status = 'pending';

    try {
      // Log registration attempt for debugging
      console.log(`Attempting to register user: ${email}`);

      const response = await fetch(`${serverAddress}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      // Log response status for debugging
      console.log(`Registration response status: ${response.status}`);

      const data = await response.json();

      if (response.ok) {
        // Set explicit success flag for tests
        window.registrationSuccess = true;
        registerMessage.dataset.status = 'success';

        const successMessage = 'Registration successful! You can now log in.';
        registerMessage.textContent = successMessage;
        registerMessage.style.color = 'var(--success-color)';
        emailInput.value = '';
        passwordInput.value = '';

        // Reset validation UI state after successful registration
        this.passwordValidator.validatePassword('');

        // Hide registration form and show the button again
        const registerWrapper = document.querySelector('#register-section-wrapper');
        const showRegisterBtn = document.querySelector('#show-register-btn');
        const loginMessage = document.querySelector('#login-message');

        // Move success message to the login form's message area
        if (loginMessage) {
          loginMessage.textContent = successMessage;
          loginMessage.style.color = 'var(--success-color)';
          loginMessage.dataset.source = 'registration';
          // Make sure it's visible
          loginMessage.style.display = 'block';
        }

        // Make sure to properly hide the registration section
        if (registerWrapper) {
          // Use both CSS class and style attribute to ensure it's hidden
          registerWrapper.classList.add('hidden');
          registerWrapper.style.display = 'none';
          // Add data attribute for more reliable test detection
          registerWrapper.dataset.hidden = 'true';
        }

        // Make sure the show register button is visible again
        if (showRegisterBtn) {
          // Ensure we make the button clearly visible with triple-redundant approach

          // 1. Use classList API
          showRegisterBtn.classList.remove('hidden');

          // 2. Use direct style properties
          showRegisterBtn.style.display = 'block';
          showRegisterBtn.style.visibility = 'visible';
          showRegisterBtn.style.opacity = '1';

          // 3. Use dataset for test detection
          showRegisterBtn.dataset.visible = 'true';
          showRegisterBtn.dataset.state = 'visible';

          // 4. Use attributes as another fallback
          showRegisterBtn.setAttribute('aria-hidden', 'false');

          // Force layout recalculation to ensure changes take effect
          void showRegisterBtn.offsetHeight;
          void showRegisterBtn.getBoundingClientRect();

          // Add a small delay to ensure styles are applied
          setTimeout(() => {
            // Double-check visibility and fix if needed
            if (window.getComputedStyle(showRegisterBtn).display === 'none') {
              console.warn('Button still hidden after registration - forcing visibility');
              showRegisterBtn.style.cssText =
                'display: block !important; visibility: visible !important; opacity: 1 !important;';
            }
          }, 0);
        }

        // Explicitly log for debugging
        console.log(
          'Registration success: Show register button visibility:',
          showRegisterBtn
            ? `Visible=${!showRegisterBtn.classList.contains('hidden')}, Display=${showRegisterBtn.style.display}, Visibility=${showRegisterBtn.style.visibility}`
            : 'Button not found'
        );

        // Focus login email field
        document.querySelector('#email')?.focus();

        return true;
      } else {
        // Set explicit failure indicators
        window.registrationSuccess = false;
        registerMessage.dataset.status = 'error';

        registerMessage.textContent = ''; // Clear "Registering..."
        console.warn(`Registration failed: ${data.message || 'Registration failed'}`);
        errorHandler.showError(data.message || 'Registration failed. Email might already exist.');

        return false;
      }
    } catch (error) {
      // Set explicit failure indicators
      window.registrationSuccess = false;
      registerMessage.dataset.status = 'error';

      registerMessage.textContent = ''; // Clear "Registering..."
      console.error('Registration error:', error);
      errorHandler.handleApiError(error);

      return false;
    }
  }

  togglePasswordVisibility(inputElement, toggleButton) {
    if (!inputElement || !toggleButton) return;
    const type = inputElement.type === 'password' ? 'text' : 'password';
    inputElement.type = type;
    toggleButton.innerHTML = `<i class="fas fa-eye${type === 'password' ? '' : '-slash'}"></i>`;
  }

  initializePasswordValidation(passwordInput, registerForm) {
    if (!passwordInput || !registerForm) return;

    // Find or create validation container
    let validationContainer = registerForm.querySelector('.password-requirements');
    if (!validationContainer) {
      validationContainer = this.passwordValidator.createValidationContainer();
      if (validationContainer instanceof Node) {
        // Insert after the input-group containing the password input
        const parentGroup = passwordInput.closest('.input-group');
        if (parentGroup && parentGroup.parentNode) {
          parentGroup.parentNode.insertBefore(validationContainer, parentGroup.nextSibling);
        } else {
          console.error('Could not find appropriate location to insert password requirements UI.');
          validationContainer = null; // Prevent hiding non-existent container
        }
      } else {
        // Likely in a test environment where DOM element creation is mocked/null
        // console.warn('Password validation container was not created (likely in test environment).');
        validationContainer = null;
      }
    }
    if (validationContainer) validationContainer.style.display = 'none'; // Start hidden

    // Find or create toggle button
    const inputGroup = passwordInput.closest('.input-group');
    if (inputGroup) {
      let togglePasswordBtn = inputGroup.querySelector('.toggle-password-btn');
      if (!togglePasswordBtn) {
        togglePasswordBtn = document.createElement('button');
        togglePasswordBtn.type = 'button';
        togglePasswordBtn.className = 'toggle-password-btn';
        togglePasswordBtn.innerHTML = '<i class="fas fa-eye"></i>';
        // Insert after the password input within the same group
        passwordInput.after(togglePasswordBtn);
      }
      // Ensure listener is attached correctly, removing old one if exists
      if (togglePasswordBtn) {
        if (this._passwordToggleHandler) {
          togglePasswordBtn.removeEventListener('click', this._passwordToggleHandler);
        }
        this._passwordToggleHandler = () =>
          this.togglePasswordVisibility(passwordInput, togglePasswordBtn);
        togglePasswordBtn.addEventListener('click', this._passwordToggleHandler);
      }
    } else {
      console.error('Could not find parent .input-group for registration password input.');
    }

    // Add real-time validation listener
    passwordInput.addEventListener('input', (e) => {
      const isValid = this.passwordValidator.validatePassword(e.target.value);
      const submitButton = registerForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = !isValid;

        // Add visual feedback with class
        if (isValid) {
          submitButton.classList.remove('validation-disabled');

          // Clear validation message
          const registerMessage = document.querySelector('#register-message');
          if (registerMessage && registerMessage.classList.contains('validation-message')) {
            registerMessage.textContent = '';
            registerMessage.classList.remove('validation-message');
          }
        } else {
          submitButton.classList.add('validation-disabled');

          // Show feedback message if validation container is not visible
          const validationContainer = registerForm.querySelector('.password-requirements');
          if (!validationContainer || validationContainer.style.display === 'none') {
            const registerMessage = document.querySelector('#register-message');
            if (registerMessage) {
              registerMessage.textContent = 'Password must meet all requirements';
              registerMessage.style.color = '#e07c31'; // warning color
              registerMessage.classList.add('validation-message');
            }
          }
        }
      }

      // Update individual requirement display
      for (const req of this.passwordValidator.requirements) {
        this.passwordValidator.updateRequirement(req, req.validate(e.target.value));
      }
    });

    // Show validation on focus
    passwordInput.addEventListener('blur', () => {
      const container = registerForm.querySelector('.password-requirements');
      if (container) {
        // Only hide if focus moved to a non-related element
        setTimeout(() => {
          if (!registerForm.contains(document.activeElement)) {
            container.style.display = 'none';
          }
        }, 100);
      }
    });

    passwordInput.addEventListener('focus', () => {
      const container = registerForm.querySelector('.password-requirements');
      if (container) container.style.display = 'block';
    });
  }

  initializeForms() {
    // Login Form
    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', this.handleLogin.bind(this));
      const loginPasswordInput = document.querySelector('#password');
      if (loginPasswordInput) {
        const inputGroup = loginPasswordInput.closest('.input-group');
        if (inputGroup) {
          let loginToggleBtn = inputGroup.querySelector('.toggle-password-btn');
          if (!loginToggleBtn) {
            loginToggleBtn = document.createElement('button');
            loginToggleBtn.type = 'button';
            loginToggleBtn.className = 'toggle-password-btn';
            loginToggleBtn.innerHTML = '<i class="fas fa-eye"></i>';
            loginPasswordInput.after(loginToggleBtn);
          }
          // Ensure listener is attached correctly, removing old one if exists
          if (loginToggleBtn) {
            if (this._loginPasswordToggleHandler) {
              loginToggleBtn.removeEventListener('click', this._loginPasswordToggleHandler);
            }
            this._loginPasswordToggleHandler = () =>
              this.togglePasswordVisibility(loginPasswordInput, loginToggleBtn);
            loginToggleBtn.addEventListener('click', this._loginPasswordToggleHandler);
          }
        } else {
          console.error('Could not find parent .input-group for login password input.');
        }
      }
    }

    // Registration Form
    const registerForm = document.querySelector('#register-form');
    if (registerForm) {
      registerForm.addEventListener('submit', this.handleRegister.bind(this));
      const registerPasswordInput = document.querySelector('#register-password');
      if (registerPasswordInput) {
        this.initializePasswordValidation(registerPasswordInput, registerForm);
      }
    }

    // Show Registration Button
    const showRegisterBtn = document.querySelector('#show-register-btn');
    const registerWrapper = document.querySelector('#register-section-wrapper');
    if (showRegisterBtn && registerWrapper) {
      // Remove potential old listener if re-initializing
      showRegisterBtn.onclick = null;
      showRegisterBtn.addEventListener('click', () => {
        // Use both class and explicit styling for maximum compatibility with tests
        registerWrapper.classList.remove('hidden');
        registerWrapper.style.display = 'block';
        registerWrapper.style.visibility = 'visible';

        // Hide button with both class and style
        showRegisterBtn.classList.add('hidden');
        showRegisterBtn.style.display = 'none';

        // Set data attribute for test detection
        registerWrapper.dataset.visible = 'true';

        // Force a browser reflow for immediate visibility
        registerWrapper.offsetHeight;

        // Focus first field in register form
        document.querySelector('#register-email')?.focus();

        console.log('Show registration form clicked: form visibility updated');
      });
    }
  }

  checkAuthAndRedirect() {
    // Use the encapsulated method that handles validation, clearing tokens,
    // and redirecting if needed - all within a single atomic operation
    AuthUtils.handleTokenExpiration();
  }
}

export function initAuth() {
  // Wait for error handler initialization to complete
  errorHandler.init();
  // Small delay to ensure DOM updates
  setTimeout(() => {
    const authManager = new AuthManager();
    authManager.initializeForms();
    authManager.updateLoginStatus();
    authManager.checkAuthAndRedirect();
    AuthUtils.initAuthCheck();
  }, 0);
}
