const getServerAddress = () => {
  const { hostname } = window.location;
  const { port } = window.location;

  if (hostname === 'localhost' && port === '8080') {
    return 'http://localhost:9000/api';
  }
  if (hostname === 'frontend') {
    return 'http://backend:9000/api';
  }
  if (hostname === 'test-lingua-quiz.nikolay-eremeev.com') {
    return 'https://test-api-lingua-quiz.nikolay-eremeev.com/api';
  }
  if (hostname === 'lingua-quiz.nikolay-eremeev.com') {
    return 'https://api-lingua-quiz.nikolay-eremeev.com/api';
  }
  return '/api'; // fallback
};

const serverAddress = getServerAddress();

const api = {
  async login(email, password) {
    const response = await fetch(`${serverAddress}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async register(email, password) {
    const response = await fetch(`${serverAddress}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Registration failed');
    return data;
  },

  async fetchWordSets(token) {
    const response = await fetch(`${serverAddress}/word-sets`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      throw new Error('Failed to fetch word sets');
    }

    return response.json();
  },

  async fetchUserWordSets(token, wordListName) {
    const response = await fetch(`${serverAddress}/word-sets/user?wordListName=${encodeURIComponent(wordListName)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      throw new Error('Failed to fetch user word sets');
    }

    return response.json();
  },

  async saveWordStatus(token, status, wordPairIds) {
    const response = await fetch(`${serverAddress}/word-sets/user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, wordPairIds }),
    });

    if (!response.ok) throw new Error('Failed to save quiz state');
  },
};

export default api;
