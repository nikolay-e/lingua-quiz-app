import { writable, get, derived, type Writable } from 'svelte/store';
import { jwtDecode } from 'jwt-decode';
import api from './api';
import { QuizManager, type QuizQuestion, type SubmissionResult } from '@lingua-quiz/core';
import type { WordSet, LevelWordLists, TranslationDisplay, AuthResponse } from './api-types';
import { STORAGE_KEYS, THEMES } from './lib/constants';
import { LEVEL_CONFIG } from './lib/config/levelConfig';

const safeStorage = {
  getItem: (key: string): string | null => {
    if (typeof localStorage === 'undefined') return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(key, value);
    } catch {
      console.warn(`Failed to save to localStorage: ${key}`);
    }
  },
  removeItem: (key: string): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(key);
    } catch {
      console.warn(`Failed to remove from localStorage: ${key}`);
    }
  },
};

interface ThemeState {
  isDarkMode: boolean;
}

interface ThemeStore {
  subscribe: Writable<ThemeState>['subscribe'];
  toggleTheme: () => void;
  clearPreference: () => void;
}

function createThemeStore(): ThemeStore {
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return false;
    const savedTheme = safeStorage.getItem(STORAGE_KEYS.THEME);
    if (savedTheme) return savedTheme === THEMES.DARK;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const applyTheme = (isDark: boolean) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
  };

  const initialTheme = getInitialTheme();

  const { subscribe, set, update } = writable({
    isDarkMode: initialTheme,
  });

  applyTheme(initialTheme);

  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!safeStorage.getItem(STORAGE_KEYS.THEME)) {
        const isDark = e.matches;
        applyTheme(isDark);
        set({ isDarkMode: isDark });
      }
    });
  }

  return {
    subscribe,
    toggleTheme: () => {
      update((state) => {
        const newTheme = !state.isDarkMode;
        safeStorage.setItem(STORAGE_KEYS.THEME, newTheme ? 'dark' : 'light');
        applyTheme(newTheme);
        return { isDarkMode: newTheme };
      });
    },
    clearPreference: () => {
      safeStorage.removeItem(STORAGE_KEYS.THEME);
      const systemPreference =
        typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemPreference);
      set({ isDarkMode: systemPreference });
    },
  };
}

export const themeStore = createThemeStore();

interface AuthState {
  token: string | null;
  username: string | null;
  isAuthenticated: boolean;
}

interface AuthStore {
  subscribe: Writable<AuthState>['subscribe'];
  login: (username: string, password: string) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  logoutUser: () => void;
  register: (username: string, password: string) => Promise<AuthResponse>;
  deleteAccount: () => Promise<void>;
}

function createAuthStore(): AuthStore {
  const { subscribe, set } = writable<AuthState>({
    token: null,
    username: null,
    isAuthenticated: false,
  });

  function checkToken() {
    const token = safeStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      set({ token: null, username: null, isAuthenticated: false });
      return;
    }

    try {
      const payload = jwtDecode<{ exp: number; username?: string; sub?: string }>(token);
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        logoutUser();
      } else {
        const username = payload.username ?? payload.sub ?? 'Unknown User';
        set({ token, username, isAuthenticated: true });
      }
    } catch {
      console.error('Invalid token found, logging out.');
      logoutUser();
    }
  }

  function setUser(data: { token: string; username: string }) {
    safeStorage.setItem(STORAGE_KEYS.TOKEN, data.token);

    try {
      const payload = jwtDecode<{ exp: number }>(data.token);
      const expirationMs = payload.exp * 1000;
      safeStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRATION, expirationMs.toString());
    } catch (e) {
      console.error('Failed to parse token expiration:', e);
    }
    set({ token: data.token, username: data.username, isAuthenticated: true });
  }

  function logoutUser() {
    safeStorage.removeItem(STORAGE_KEYS.TOKEN);
    safeStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRATION);
    set({ token: null, username: null, isAuthenticated: false });
  }

  if (typeof window !== 'undefined') {
    checkToken();
  }

  return {
    subscribe,
    login: async (username: string, password: string) => {
      const data = await api.login({ username, password });
      setUser({ token: data.token, username: data.user.username });
      return data;
    },
    logout: async () => {
      const state = get({ subscribe });
      if (state.token) {
        try {
          await quizStore.saveAndCleanup(state.token);
        } catch (error) {
          console.error('Failed to save quiz progress during logout:', error);
        }
      }
      logoutUser();
    },
    logoutUser,
    register: async (username: string, password: string) => {
      const data = await api.register({ username, password });
      setUser({ token: data.token, username: data.user.username });
      return data;
    },
    deleteAccount: async () => {
      const state = get({ subscribe });
      if (!state.token) throw new Error('Not authenticated');

      await api.deleteAccount(state.token);
      logoutUser();
    },
  };
}

interface QuizState {
  wordSets: WordSet[];
  selectedQuiz: string | null;
  quizManager: QuizManager | null;
  currentQuestion: QuizQuestion | null;
  sessionId: string | null;
  loading: boolean;
  error: string | null;
}

interface QuizStore {
  subscribe: Writable<QuizState>['subscribe'];
  loadWordSets: (token: string) => Promise<void>;
  startQuiz: (token: string, quizName: string) => Promise<void>;
  getNextQuestion: () => QuizQuestion | null;
  submitAnswer: (token: string, answer: string) => Promise<SubmissionResult | null>;
  setLevel: (
    level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4',
  ) => Promise<{ success: boolean; actualLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; message?: string }>;
  reset: () => void;
  saveAndCleanup: (token: string) => Promise<void>;
}

function createQuizStore(): QuizStore {
  const { subscribe, set, update } = writable<QuizState>({
    wordSets: [],
    selectedQuiz: null,
    quizManager: null,
    currentQuestion: null,
    sessionId: null,
    loading: false,
    error: null,
  });

  const DEBOUNCE_DELAY = 1000;
  let debounceTimer: NodeJS.Timeout | null = null;

  const bulkSaveProgress = async (token: string): Promise<void> => {
    const state = get(store);
    if (!state.quizManager) return;

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    try {
      const wordsByLevel = state.quizManager.getWordsByLevel();
      const persistencePromises: Promise<void>[] = [];

      for (const [level, wordIds] of Object.entries(wordsByLevel)) {
        const wordArray = wordIds as number[];
        if (wordArray.length > 0) {
          persistencePromises.push(
            api.saveWordStatus(token, { status: level, wordPairIds: wordArray }).catch((err) => {
              console.error(`Bulk save failed for ${level}:`, err);
              return Promise.resolve();
            }),
          );
        }
      }

      if (persistencePromises.length > 0) {
        await Promise.allSettled(persistencePromises);
      }
    } catch (error) {
      const errorInfo = handleQuiz401Error(error);
      if (!errorInfo.isUnauthorized) {
        console.error('Bulk save error:', error);
      }
    }
  };

  const debouncedBulkSave = (token: string) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => bulkSaveProgress(token), DEBOUNCE_DELAY);
  };

  const handleQuiz401Error = (error: unknown) => {
    if (error instanceof Error && error.message === 'Unauthorized') {
      console.warn('Session expired during quiz operation. Redirecting to login.');
      authStore.logoutUser();
      return { isUnauthorized: true, message: 'Your session has expired. Please log in again.' };
    }
    return { isUnauthorized: false, message: error instanceof Error ? error.message : 'Unknown error' };
  };

  async function withAuth401Handling<T>(
    operation: () => Promise<T>,
    onError?: (error: unknown) => void,
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorInfo = handleQuiz401Error(error);
      if (onError) {
        onError(errorInfo.message);
      }
      if (!errorInfo.isUnauthorized) {
        throw error;
      }
      return null;
    }
  }

  const store = {
    subscribe,

    loadWordSets: async (token: string) => {
      update((state) => ({ ...state, loading: true, error: null }));
      const result = await withAuth401Handling(
        () => api.fetchWordSets(token),
        (error) => update((state) => ({ ...state, error: error as string, loading: false })),
      );

      if (result) {
        update((state) => ({ ...state, wordSets: result, loading: false }));
      }
    },

    startQuiz: async (token: string, quizName: string) => {
      update((state) => ({ ...state, loading: true, error: null, selectedQuiz: quizName }));

      const result = await withAuth401Handling(
        async () => {
          const userWordSets = await api.fetchUserWordSets(token, quizName);

          const translations = userWordSets.map((word) => ({
            id: word.wordPairId,
            sourceWord: {
              text: word.sourceWord,
              language: word.sourceLanguage,
              usageExample: word.sourceWordUsageExample ?? '',
            },
            targetWord: {
              text: word.targetWord,
              language: word.targetLanguage,
              usageExample: word.targetWordUsageExample ?? '',
            },
          }));

          const progress = userWordSets.map((word) => ({
            translationId: word.wordPairId,
            status: (word.status ?? 'LEVEL_0') as 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5',
            queuePosition: 0,
            consecutiveCorrect: 0,
            recentHistory: [] as boolean[],
          }));

          let currentLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' = 'LEVEL_1';
          try {
            const userLevelData = await api.getCurrentLevel(token);
            currentLevel = userLevelData.currentLevel as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
          } catch {
            console.warn('Failed to load user level, using default LEVEL_1');
          }

          const manager = new QuizManager(translations, {
            progress,
            currentLevel,
          });

          await bulkSaveProgress(token);

          const questionResult = manager.getNextQuestion();
          const currentQuestion = questionResult.question;

          return { manager, currentQuestion };
        },
        (error) => update((state) => ({ ...state, error: error as string, loading: false })),
      );

      if (result) {
        update((state) => ({
          ...state,
          loading: false,
          quizManager: result.manager,
          currentQuestion: result.currentQuestion,
        }));
      }
    },

    getNextQuestion: () => {
      const state = get(store);
      if (!state.quizManager) return null;

      const questionResult = state.quizManager.getNextQuestion();
      const { question } = questionResult;

      update((s) => ({ ...s, currentQuestion: question }));
      return question;
    },

    submitAnswer: async (token: string, answer: string) => {
      const state = get(store);
      if (!state.quizManager || !state.currentQuestion) return null;

      try {
        const oldLevel = state.quizManager.getCurrentLevel();
        const feedback = state.quizManager.submitAnswer(state.currentQuestion.translationId, answer);
        const newLevel = state.quizManager.getCurrentLevel();

        if (oldLevel !== newLevel) {
          api.updateCurrentLevel(token, { currentLevel: newLevel }).catch((error) => {
            console.error('Failed to persist level change:', error);
          });
        }

        debouncedBulkSave(token);

        return feedback;
      } catch (error) {
        console.error('Failed to submit answer:', error);
        throw error;
      }
    },

    setLevel: async (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4', token?: string) => {
      const state = get(store);
      if (!state.quizManager) {
        return { success: false, actualLevel: 'LEVEL_1' as const, message: 'Quiz not initialized' };
      }

      try {
        if (token) {
          try {
            await bulkSaveProgress(token);
          } catch (error) {
            console.error('Failed to save progress before level change:', error);
          }
        }

        const result = state.quizManager.setLevel(level);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;

        update((s) => ({ ...s, currentQuestion: nextQuestion }));

        if (token) {
          try {
            await api.updateCurrentLevel(token, { currentLevel: result.actualLevel });
          } catch (error) {
            console.error('Failed to persist level to backend:', error);
          }
        }

        return result;
      } catch (error) {
        console.error('Failed to set level:', error);
        return { success: false, actualLevel: 'LEVEL_1' as const, message: 'Failed to set level' };
      }
    },

    reset: () => {
      const state = get(store);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      set({
        wordSets: state.wordSets,
        selectedQuiz: null,
        quizManager: null,
        currentQuestion: null,
        sessionId: null,
        loading: false,
        error: null,
      });
    },

    saveAndCleanup: (token: string) => {
      const state = get(store);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (state.quizManager) {
        void bulkSaveProgress(token).catch((err) => console.error('Failed to save progress on stop:', err));
      }
      return Promise.resolve();
    },
  };

  return store;
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();

export { safeStorage };

export const levelWordLists = derived(
  quizStore,
  ($quizStore, set) => {
    if (!$quizStore.quizManager) {
      const emptyLevelWordLists = LEVEL_CONFIG.reduce((acc, level) => {
        acc[level.id] = { ...level, words: [], count: 0 };
        return acc;
      }, {} as LevelWordLists);
      set(emptyLevelWordLists);
      return;
    }

    const state = $quizStore.quizManager.getState();
    const manager = $quizStore.quizManager;

    const newLevelWordLists = LEVEL_CONFIG.reduce((acc, level) => {
      const words =
        state.queues[level.key as keyof typeof state.queues]
          ?.map((id) => manager.getTranslationForDisplay(id))
          .filter((translation): translation is TranslationDisplay => translation !== undefined)
          .map((w) => `${w.source} -> ${w.target}`) || [];

      acc[level.id] = {
        ...level,
        words,
        count: state.queues[level.key as keyof typeof state.queues]?.length || 0,
      };
      return acc;
    }, {} as LevelWordLists);

    set(newLevelWordLists);
  },
  {} as LevelWordLists,
);
