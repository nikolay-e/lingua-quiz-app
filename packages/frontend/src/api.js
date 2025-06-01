const getServerAddress = () => {
  const { hostname, port, protocol } = window.location;

  // Environment variable override (for Docker and other deployment scenarios)
  if (window.LINGUA_QUIZ_API_URL) {
    return window.LINGUA_QUIZ_API_URL;
  }

  // Development scenarios
  if (hostname === 'localhost') {
    if (port === '8080') {
      return 'http://localhost:9000/api';
    }
    // Handle other development ports
    return `http://localhost:9000/api`;
  }
  
  // Docker internal networking
  if (hostname === 'frontend') {
    return 'http://backend:9000/api';
  }
  
  // Generic production fallback - assume API is on same domain with /api path
  if (protocol === 'https:') {
    return `https://${hostname}/api`;
  }
  
  return '/api'; // fallback for same-origin deployment
};

const serverAddress = getServerAddress();

const api = {
  async login(username, password) {
    const response = await fetch(`${serverAddress}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Login failed');
    return data;
  },

  async register(username, password) {
    const response = await fetch(`${serverAddress}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
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

  async startQuiz(token, wordListName) {
    const response = await fetch(`${serverAddress}/quiz/start`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ wordListName })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to start quiz');
    return data;
  },

  async getNextQuestion(token, wordListName) {
    const response = await fetch(
      `${serverAddress}/quiz/next-question?wordListName=${encodeURIComponent(wordListName)}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to get next question');
    return data;
  },

  async submitAnswer(token, wordListName, translationId, answer, displayedWord) {
    const response = await fetch(`${serverAddress}/quiz/submit-answer`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ wordListName, translationId, answer, displayedWord })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to submit answer');
    return data;
  },

  async toggleDirection(token, wordListName) {
    const response = await fetch(`${serverAddress}/quiz/toggle-direction`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ wordListName })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to toggle direction');
    return data;
  },

  async getQuizState(token, wordListName) {
    const response = await fetch(
      `${serverAddress}/quiz/state?wordListName=${encodeURIComponent(wordListName)}`,
      {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to get quiz state');
    return data;
  },

  async synthesizeSpeech(token, text, language) {
    const response = await fetch(`${serverAddress}/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, language })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to synthesize speech');
    return data;
  },

  async getTTSLanguages(token) {
    const response = await fetch(`${serverAddress}/tts/languages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || 'Failed to get TTS languages');
    return data;
  },
};

export default api;
