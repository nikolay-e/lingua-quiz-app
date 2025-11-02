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

import type {
  AuthResponse,
  WordSet,
  UserWordSet,
  TTSResponse,
  TTSLanguagesResponse,
  WordSetWithWords,
} from './api-types';

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
 * Factory function for creating API methods
 */
const createApiMethod = <TResponse, TParams = void>(endpoint: string, method = 'GET', requiresAuth = true) => {
  if (requiresAuth) {
    return async (token: string, params?: TParams): Promise<TResponse> => {
      const url = `${serverAddress}${endpoint}`;
      const options = withAuth(token, { method });

      if (params && method !== 'GET' && method !== 'DELETE') {
        options.headers = {
          ...options.headers,
          'Content-Type': 'application/json',
        };
        options.body = JSON.stringify(params);
      }

      return fetchWrapper<TResponse>(url, options);
    };
  }
  return async (params: TParams): Promise<TResponse> => {
    const options: RequestInit = { method };

    if (params && method !== 'GET' && method !== 'DELETE') {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(params);
    }

    return fetchWrapper<TResponse>(`${serverAddress}${endpoint}`, options);
  };
};

/**
 * API client for communicating with the LinguaQuiz backend
 */
const api = {
  // Authentication methods (no auth required)
  login: createApiMethod<AuthResponse, { username: string; password: string }>('/auth/login', 'POST', false),
  register: createApiMethod<AuthResponse, { username: string; password: string }>('/auth/register', 'POST', false),

  // Word sets methods
  fetchWordSets: createApiMethod<WordSet[]>('/word-sets'),
  saveWordStatus: createApiMethod<void, { status: string; wordPairIds: number[] }>('/word-sets/user', 'POST'),

  // TTS methods
  synthesizeSpeech: createApiMethod<TTSResponse, { text: string; language: string }>('/tts/synthesize', 'POST'),
  getTTSLanguages: createApiMethod<TTSLanguagesResponse>('/tts/languages'),

  // User methods
  deleteAccount: createApiMethod<void>('/auth/delete-account', 'DELETE'),
  getCurrentLevel: createApiMethod<{ currentLevel: string }>('/user/current-level'),
  updateCurrentLevel: createApiMethod<void, { currentLevel: string }>('/user/current-level', 'POST'),

  // Custom methods that need special handling
  async fetchUserWordSets(token: string, wordListName: string): Promise<UserWordSet[]> {
    return fetchWrapper(
      `${serverAddress}/word-sets/user?word_list_name=${encodeURIComponent(wordListName)}`,
      withAuth(token, { method: 'GET' }),
    );
  },

  async fetchWordSet(token: string, wordSetId: number): Promise<WordSetWithWords> {
    return fetchWrapper(`${serverAddress}/word-sets/${wordSetId}`, withAuth(token, { method: 'GET' }));
  },
};

export default api;
