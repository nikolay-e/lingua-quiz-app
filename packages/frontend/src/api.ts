/**
 * Global window interface extension for environment variables
 */
declare global {
  interface Window {
    LINGUA_QUIZ_API_URL?: string;
  }
}

/**
 * Determines the server address based on build-time environment variables
 * @returns The API server address
 */
const getServerAddress = (): string => {
  // Build-time environment variable (preferred method)
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }

  // Runtime environment variable override (for Docker and other deployment scenarios)
  if (window.LINGUA_QUIZ_API_URL) {
    return window.LINGUA_QUIZ_API_URL;
  }

  // Simple fallback for same-origin deployment
  return '/api';
};

import type { AuthResponse, WordSet, UserWordSet, TTSResponse, TTSLanguagesResponse, WordSetWithWords } from './api-types';

const serverAddress = getServerAddress();

/**
 * Centralized fetch wrapper that handles common API tasks:
 * - Authorization headers
 * - Response status checking
 * - Error parsing and handling
 * - JSON response parsing
 */
async function fetchWrapper<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      // If JSON parsing fails, create a generic error
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Handle specific HTTP status codes
    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Resource not found');
    }

    // Handle FastAPI validation errors (arrays of error objects)
    if (errorData.detail && Array.isArray(errorData.detail)) {
      const errors = errorData.detail
        .map((err: { msg?: string; message?: string }) => err.msg || err.message)
        .filter(Boolean)
        .join(', ');
      throw new Error(errors || `Request failed with status ${response.status}`);
    }

    // Handle other error formats
    const errorMessage = errorData.message || errorData.detail || `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  // Safely handle empty bodies
  const cl = response.headers.get('content-length');
  if (response.status === 204 || cl === '0' || cl === null) {
    // Try text first; some servers send empty string without content-length
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as unknown as T;
  }

  // Some servers omit content-length; try/catch JSON parse
  try {
    return await response.json();
  } catch {
    return undefined as unknown as T;
  }
}

/**
 * Creates request options with Authorization header
 */
function withAuth(token: string, options: RequestInit = {}): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };
}

/**
 * API client for communicating with the LinguaQuiz backend
 */
const api = {
  async login(username: string, password: string): Promise<AuthResponse> {
    return fetchWrapper(`${serverAddress}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  async register(username: string, password: string): Promise<AuthResponse> {
    return fetchWrapper(`${serverAddress}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  async fetchWordSets(token: string): Promise<WordSet[]> {
    return fetchWrapper(`${serverAddress}/word-sets`, withAuth(token, { method: 'GET' }));
  },

  async fetchUserWordSets(token: string, wordListName: string): Promise<UserWordSet[]> {
    return fetchWrapper(`${serverAddress}/word-sets/user?word_list_name=${encodeURIComponent(wordListName)}`, withAuth(token, { method: 'GET' }));
  },

  async saveWordStatus(
    token: string,
    status: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5',
    wordPairIds: number[]
  ): Promise<void> {
    await fetchWrapper(
      `${serverAddress}/word-sets/user`,
      withAuth(token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, wordPairIds }),
      })
    );
  },

  async synthesizeSpeech(token: string, text: string, language: string): Promise<TTSResponse> {
    return fetchWrapper(
      `${serverAddress}/tts/synthesize`,
      withAuth(token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
      })
    );
  },

  async getTTSLanguages(token: string): Promise<TTSLanguagesResponse> {
    return fetchWrapper(`${serverAddress}/tts/languages`, withAuth(token, { method: 'GET' }));
  },

  async deleteAccount(token: string): Promise<void> {
    await fetchWrapper(`${serverAddress}/auth/delete-account`, withAuth(token, { method: 'DELETE' }));
  },

  async getCurrentLevel(token: string): Promise<{ currentLevel: string }> {
    return fetchWrapper(`${serverAddress}/user/current-level`, withAuth(token, { method: 'GET' }));
  },

  async updateCurrentLevel(token: string, currentLevel: string): Promise<void> {
    await fetchWrapper(
      `${serverAddress}/user/current-level`,
      withAuth(token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentLevel }),
      })
    );
  },

  async fetchWordSet(token: string, wordSetId: number): Promise<WordSetWithWords> {
    return fetchWrapper(`${serverAddress}/word-sets/${wordSetId}`, withAuth(token, { method: 'GET' }));
  },
};

export default api;
