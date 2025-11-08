declare global {
  interface Window {
    LINGUA_QUIZ_API_URL?: string;
  }
}

const getServerAddress = (): string => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL as string;
  }

  if (window.LINGUA_QUIZ_API_URL) {
    return window.LINGUA_QUIZ_API_URL;
  }

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

async function fetchWrapper<T = unknown>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(url, options);

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    if (response.status === 401) {
      throw new Error('Unauthorized');
    }
    if (response.status === 404) {
      throw new Error('Resource not found');
    }

    if (errorData.detail && Array.isArray(errorData.detail)) {
      const errors = errorData.detail
        .map((err: { msg?: string; message?: string }) => err.msg ?? err.message)
        .filter(Boolean)
        .join(', ');
      const errorMessage = errors.length > 0 ? errors : `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }

    const errorMessage = errorData.message ?? errorData.detail ?? `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  const cl = response.headers.get('content-length');
  if (response.status === 204 || cl === '0' || cl === null) {
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as unknown as T;
  }

  try {
    return await response.json();
  } catch {
    return undefined as unknown as T;
  }
}

function withAuth(token: string, options: RequestInit = {}): RequestInit {
  return {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${token}`,
    },
  };
}

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

const api = {
  login: createApiMethod<AuthResponse, { username: string; password: string }>('/auth/login', 'POST', false),
  register: createApiMethod<AuthResponse, { username: string; password: string }>('/auth/register', 'POST', false),

  fetchWordSets: createApiMethod<WordSet[]>('/word-sets'),
  saveWordStatus: createApiMethod<void, { status: string; wordPairIds: number[] }>('/word-sets/user', 'POST'),

  synthesizeSpeech: createApiMethod<TTSResponse, { text: string; language: string }>('/tts/synthesize', 'POST'),
  getTTSLanguages: createApiMethod<TTSLanguagesResponse>('/tts/languages'),

  deleteAccount: createApiMethod<void>('/auth/delete-account', 'DELETE'),
  getCurrentLevel: createApiMethod<{ currentLevel: string }>('/user/current-level'),
  updateCurrentLevel: createApiMethod<void, { currentLevel: string }>('/user/current-level', 'POST'),

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
