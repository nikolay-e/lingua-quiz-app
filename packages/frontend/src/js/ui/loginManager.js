const SERVER_ADDRESS =
  process.env.NODE_ENV === 'production'
    ? 'https://api-lingua-quiz.nikolay-eremeev.com:443'
    : 'https://test-api-lingua-quiz.nikolay-eremeev.com:443';

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

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const loginMessage = document.getElementById('login-message');

  try {
    const response = await fetch(`${SERVER_ADDRESS}/login`, {
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
        window.location.href = '/'; // Redirect to the home page
      }, 1500);
    } else {
      loginMessage.textContent = data.message || 'Invalid credentials';
    }
  } catch (error) {
    console.error('Login error:', error);
    loginMessage.textContent = `An error occurred: ${error.message}. Please try again.`;
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const registerMessage = document.getElementById('register-message');

  try {
    const response = await fetch(`${SERVER_ADDRESS}/register`, {
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

function initAuth() {
  initializeForms();
  updateLoginStatus();
}

export default initAuth;
