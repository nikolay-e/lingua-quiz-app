import serverAddress from '../config.js';

function redirectToLogin() {
  window.location.href = '/login.html';
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('email');
  // eslint-disable-next-line no-use-before-define
  updateLoginStatus();
  window.location.href = 'login.html';
}

async function handleLogin(e) {
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
      loginMessage.textContent = 'Login successful. Redirecting...';
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    } else {
      loginMessage.textContent = data.message || 'Invalid credentials';
    }
  } catch (error) {
    console.error('Login error:', error);
    loginMessage.textContent = `An error occurred: ${error.message}. Please try again.`;
  }
}

function updateLoginStatus() {
  const loginLogoutBtn = document.getElementById('login-logout-btn');
  const token = localStorage.getItem('token');
  const email = localStorage.getItem('email');

  if (loginLogoutBtn) {
    if (token && email) {
      // eslint-disable-next-line max-len
      loginLogoutBtn.innerHTML = `<i class="fas fa-sign-out-alt"></i> <span>Logout (${email})</span>`;
      loginLogoutBtn.removeEventListener('click', redirectToLogin);
      loginLogoutBtn.addEventListener('click', logout);
    } else {
      loginLogoutBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> <span>Login</span>';
      loginLogoutBtn.removeEventListener('click', logout);
      if (!window.location.pathname.includes('login.html')) {
        loginLogoutBtn.addEventListener('click', redirectToLogin);
      }
    }
  }
}

async function handleRegister(e) {
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

function initializeForms() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

function checkAuthAndRedirect() {
  const token = localStorage.getItem('token');
  if (!token && window.location.pathname !== '/login.html') {
    redirectToLogin();
  }
}

function initAuth() {
  initializeForms();
  updateLoginStatus();
  checkAuthAndRedirect();
}

export default initAuth;
