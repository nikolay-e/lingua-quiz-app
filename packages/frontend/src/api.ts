/**
 * Global window interface extension for environment variables
 */
declare global {
  interface Window {
    LINGUA_QUIZ_API_URL?: string;
  }
}

/**
 * Determines the server address based on environment and current location
 * @returns The API server address
 */
const getServerAddress = (): string => {
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

import type {
  AuthResponse,
  WordSet,
  UserWordSet,
  TTSResponse,
  TTSLanguagesResponse
} from './types';

const serverAddress = getServerAddress();

/**
 * API client for communicating with the LinguaQuiz backend
 */
const api = {
  async login(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${serverAddress}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      // Handle FastAPI validation errors
      if (data.detail && Array.isArray(data.detail)) {
        const errors = data.detail.map((err: { msg?: string; message?: string }) => err.msg ?? err.message ?? 'Validation error').join(', ');
        throw new Error(errors.length > 0 ? errors : 'Login failed');
      }
      throw new Error(data.message ?? data.detail ?? 'Login failed');
    }
    return data;
  },

  async register(username: string, password: string): Promise<AuthResponse> {
    const response = await fetch(`${serverAddress}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const data = await response.json();
    if (!response.ok) {
      // Handle FastAPI validation errors
      if (data.detail && Array.isArray(data.detail)) {
        const errors = data.detail.map((err: { msg?: string; message?: string }) => err.msg ?? err.message ?? 'Validation error').join(', ');
        throw new Error(errors.length > 0 ? errors : 'Registration failed');
      }
      throw new Error(data.message ?? data.detail ?? 'Registration failed');
    }
    return data;
  },

  async fetchWordSets(token: string): Promise<WordSet[]> {
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

  async fetchUserWordSets(token: string, wordListName: string): Promise<UserWordSet[]> {
    const response = await fetch(`${serverAddress}/word-sets/user?word_list_name=${encodeURIComponent(wordListName)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      throw new Error('Failed to fetch user word sets');
    }

    return response.json();
  },

  async saveWordStatus(token: string, status: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5', translationIds: number[]): Promise<void> {
    const response = await fetch(`${serverAddress}/word-sets/user`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, translationIds }),
    });

    if (!response.ok) throw new Error('Failed to save quiz state');
  },



  async synthesizeSpeech(token: string, text: string, language: string): Promise<TTSResponse> {
    const response = await fetch(`${serverAddress}/tts/synthesize`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text, language })
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? 'Failed to synthesize speech');
    return data;
  },

  async getTTSLanguages(token: string): Promise<TTSLanguagesResponse> {
    const response = await fetch(`${serverAddress}/tts/languages`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? 'Failed to get TTS languages');
    return data;
  },

  async deleteAccount(token: string): Promise<void> {
    const response = await fetch(`${serverAddress}/auth/delete-account`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message ?? data.detail ?? 'Failed to delete account');
    }
  },

  async getCurrentLevel(token: string): Promise<{ currentLevel: string }> {
    const response = await fetch(`${serverAddress}/user/current-level`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      const data = await response.json();
      throw new Error(data.message ?? 'Failed to get current level');
    }

    return response.json();
  },

  async updateCurrentLevel(token: string, currentLevel: string): Promise<void> {
    const response = await fetch(`${serverAddress}/user/current-level`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ currentLevel }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.message ?? 'Failed to update current level');
    }
  },

  async fetchWordSet(token: string, wordSetId: number): Promise<WordSet & { words: unknown[] }> {
    const response = await fetch(`${serverAddress}/word-sets/${wordSetId}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      if (response.status === 401) throw new Error('Unauthorized');
      if (response.status === 404) throw new Error('Word set not found');
      throw new Error('Failed to fetch word set');
    }

    return response.json();
  },
};

export default api;
