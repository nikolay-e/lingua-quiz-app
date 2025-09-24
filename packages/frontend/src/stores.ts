import { writable, get, derived, type Writable } from 'svelte/store';
import { jwtDecode } from 'jwt-decode';
import api from './api';
import { QuizManager, type QuizQuestion, type SubmissionResult } from '@lingua-quiz/core';
import type { WordSet, LevelWordLists, TranslationDisplay, AuthResponse } from './api-types';
import { STORAGE_KEYS, THEMES } from './lib/constants';
import { LEVEL_CONFIG } from './lib/config/levelConfig';

interface ThemeState {
  isDarkMode: boolean;
}

interface ThemeStore {
  subscribe: Writable<ThemeState>['subscribe'];
  toggleTheme: () => void;
  clearPreference: () => void;
}

// Theme Store for dark mode (follows system preference)
function createThemeStore(): ThemeStore {
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return false;
    const savedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
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

  // Apply initial theme
  applyTheme(initialTheme);

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem(STORAGE_KEYS.THEME)) {
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
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(STORAGE_KEYS.THEME, newTheme ? 'dark' : 'light');
        }
        applyTheme(newTheme);
        return { isDarkMode: newTheme };
      });
    },
    clearPreference: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(STORAGE_KEYS.THEME);
      }
      const systemPreference = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
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

// Auth Store with SSR-safe initialization
function createAuthStore(): AuthStore {
  const { subscribe, set } = writable<AuthState>({
    token: null,
    username: null,
    isAuthenticated: false,
  });

  // Function to check token validity and update store
  function checkToken() {
    if (typeof localStorage === 'undefined') return;

    const token = localStorage.getItem(STORAGE_KEYS.TOKEN);

    if (!token) {
      set({ token: null, username: null, isAuthenticated: false });
      return;
    }

    try {
      const payload = jwtDecode<{ exp: number; username?: string; sub?: string }>(token);
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        logoutUser(); // Token is expired, log out
      } else {
        // Extract username from token payload (common JWT claims)
        const username = payload.username || payload.sub || 'Unknown User';
        set({ token, username, isAuthenticated: true });
      }
    } catch {
      console.error('Invalid token found, logging out.');
      logoutUser(); // Token is malformed
    }
  }

  // Function to set user data in localStorage and the store
  function setUser(data: { token: string; username: string }) {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.TOKEN, data.token);

      // Calculate and store token expiration
      try {
        const payload = jwtDecode<{ exp: number }>(data.token);
        const expirationMs = payload.exp * 1000;
        localStorage.setItem(STORAGE_KEYS.TOKEN_EXPIRATION, expirationMs.toString());
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }
    }
    // Username is passed from the API response, but we could also extract it from token
    set({ token: data.token, username: data.username, isAuthenticated: true });
  }

  // Function to clear user data
  function logoutUser() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.TOKEN);
      localStorage.removeItem(STORAGE_KEYS.TOKEN_EXPIRATION);
      // Note: No longer storing username separately as it's derived from token
    }
    set({ token: null, username: null, isAuthenticated: false });
  }

  // Initial check when the store is created
  if (typeof window !== 'undefined') {
    checkToken();
  }

  return {
    subscribe,
    login: async (username: string, password: string) => {
      const data = await api.login(username, password);
      setUser({ token: data.token, username: data.user.username });
      return data;
    },
    logout: async () => {
      // Ensure pending quiz data is saved before clearing session
      const state = get({ subscribe });
      if (state.token) {
        try {
          await quizStore.saveAndCleanup(state.token);
        } catch (error) {
          console.error('Failed to save quiz progress during logout:', error);
          // Continue with logout even if save fails
        }
      }
      logoutUser();
    },
    logoutUser,
    register: async (username: string, password: string) => {
      const data = await api.register(username, password);
      setUser({ token: data.token, username: data.user.username });
      return data;
    },
    deleteAccount: async () => {
      // Get current state directly from the store
      const state = get({ subscribe });
      if (!state.token) throw new Error('Not authenticated');

      await api.deleteAccount(state.token);
      logoutUser(); // Clear user session after successful deletion
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
    level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'
  ) => Promise<{ success: boolean; actualLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; message?: string }>;
  reset: () => void;
  saveAndCleanup: (token: string) => Promise<void>;
}

// Quiz Store with @lingua-quiz/core integration
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

  const DEBOUNCE_DELAY = 1000; // 1 second debounce for rapid actions
  let debounceTimer: NodeJS.Timeout | null = null;

  const bulkSaveProgress = (token: string) => {
    const state = get(store);
    if (!state.quizManager) return;

    // Clear any pending debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    try {
      const wordsByLevel = state.quizManager.getWordsByLevel();
      const persistencePromises: Promise<void>[] = [];

      // Only send API calls for levels that have words
      for (const [level, wordIds] of Object.entries(wordsByLevel)) {
        const wordArray = wordIds as number[];
        if (wordArray.length > 0) {
          persistencePromises.push(
            api.saveWordStatus(token, level as 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5', wordArray).catch((err) => {
              console.error(`Bulk save failed for ${level}:`, err);
              // Don't fail the entire operation if one level fails
              return Promise.resolve();
            })
          );
        }
      }

      if (persistencePromises.length > 0) {
        // Process API calls in background (non-blocking)
        Promise.allSettled(persistencePromises)
          .then(() => {
            // Bulk save completed for ${persistencePromises.length} levels
          })
          .catch((error) => {
            console.error('Bulk save promises failed unexpectedly:', error);
          });
      }
    } catch (error) {
      const errorInfo = handleQuiz401Error(error);
      if (!errorInfo.isUnauthorized) {
        console.error('Bulk save error:', error);
      }
    }
  };

  const debouncedBulkSave = (token: string) => {
    // Clear existing debounce timer
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // Schedule debounced save for rapid actions
    debounceTimer = setTimeout(() => bulkSaveProgress(token), DEBOUNCE_DELAY);
  };

  // Centralized 401 error handler for quiz store
  const handleQuiz401Error = (error: unknown) => {
    if (error instanceof Error && error.message === 'Unauthorized') {
      console.warn('Session expired during quiz operation. Redirecting to login.');
      authStore.logoutUser(); // Use the auth store's logout function
      return { isUnauthorized: true, message: 'Your session has expired. Please log in again.' };
    }
    return { isUnauthorized: false, message: error instanceof Error ? error.message : 'Unknown error' };
  };

  const store = {
    subscribe,

    loadWordSets: async (token: string) => {
      update((state) => ({ ...state, loading: true, error: null }));
      try {
        const wordSets = await api.fetchWordSets(token);
        // Use atomic update to avoid race conditions
        update((state) => ({ ...state, wordSets, loading: false }));
      } catch (error: unknown) {
        const errorInfo = handleQuiz401Error(error);
        // Use atomic update to avoid race conditions
        update((state) => ({ ...state, error: errorInfo.message, loading: false }));

        // If it's a 401 error, don't re-throw since user is now logged out
        if (!errorInfo.isUnauthorized) {
          throw error;
        }
      }
    },

    startQuiz: async (token: string, quizName: string) => {
      update((state) => ({ ...state, loading: true, error: null, selectedQuiz: quizName }));
      try {
        // Use the word-sets API to get translations and progress
        const userWordSets = await api.fetchUserWordSets(token, quizName);
        // Fetched words for quiz

        // Convert UserWordSet[] to the format expected by QuizManager
        const translations = userWordSets.map((word) => ({
          id: word.wordPairId,
          sourceWord: {
            text: word.sourceWord,
            language: word.sourceLanguage,
            usageExample: word.sourceWordUsageExample || '',
          },
          targetWord: {
            text: word.targetWord,
            language: word.targetLanguage,
            usageExample: word.targetWordUsageExample || '',
          },
        }));

        const progress = userWordSets.map((word) => ({
          translationId: word.wordPairId,
          status: (word.status || 'LEVEL_0') as 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5',
          queuePosition: 0,
          consecutiveCorrect: 0,
          recentHistory: [] as boolean[],
        }));

        // Get user's current level from backend
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
        // QuizManager initialized

        // Bulk save all progress after initialization (handles promotions from LEVEL_0 to LEVEL_1)
        await bulkSaveProgress(token);

        const questionResult = manager.getNextQuestion();
        const currentQuestion = questionResult.question;
        // First question loaded

        // Use atomic update to avoid race conditions
        update((state) => ({
          ...state,
          loading: false,
          quizManager: manager,
          currentQuestion,
        }));
      } catch (error: unknown) {
        const errorInfo = handleQuiz401Error(error);
        // Use atomic update to avoid race conditions
        update((state) => ({ ...state, error: errorInfo.message, loading: false }));

        // If it's a 401 error, don't re-throw since user is now logged out
        if (!errorInfo.isUnauthorized) {
          throw error;
        }
      }
    },

    getNextQuestion: () => {
      const state = get(store);
      if (!state.quizManager) return null;

      const questionResult = state.quizManager.getNextQuestion();
      const question = questionResult.question;

      // Handle automatic level changes
      if (questionResult.levelAdjusted && questionResult.newLevel) {
        // Level was auto-adjusted
      }

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

        // If level changed automatically, persist it (non-blocking)
        if (oldLevel !== newLevel) {
          api.updateCurrentLevel(token, newLevel).catch((error) => {
            console.error('Failed to persist level change:', error);
            // Level change will be retried on next save
          });
        }

        // Use debounced save for rapid answer submissions to improve performance
        debouncedBulkSave(token);

        // DO NOT advance to next question here - let the UI handle it after showing feedback

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
        // Save current progress before changing levels to prevent data loss
        if (token) {
          try {
            await bulkSaveProgress(token);
          } catch (error) {
            console.error('Failed to save progress before level change:', error);
            // Continue with level change even if save fails, but warn user
          }
        }

        const result = state.quizManager.setLevel(level);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;

        // Update UI immediately (this is synchronous, so update is fine)
        update((s) => ({ ...s, currentQuestion: nextQuestion }));

        // Persist level change to backend if token provided
        if (token) {
          try {
            await api.updateCurrentLevel(token, result.actualLevel);
            // Level persisted to backend
          } catch (error) {
            console.error('Failed to persist level to backend:', error);
            // Don't fail the level change if persistence fails
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
      // Clear debounce timer if any
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      set({
        wordSets: state.wordSets, // Keep the loaded word sets
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
      // Clear any pending debounce timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      // Save current progress (non-blocking)
      if (state.quizManager) {
        bulkSaveProgress(token);
      }
      return Promise.resolve(); // Return resolved promise for compatibility
    },
  };

  return store;
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();

// Derived store for level word lists - efficiently calculates and caches level data
export const levelWordLists = derived(
  quizStore,
  ($quizStore, set) => {
    if (!$quizStore.quizManager) {
      // No quiz manager - return empty state
      const emptyLevelWordLists = LEVEL_CONFIG.reduce((acc, level) => {
        acc[level.id] = { ...level, words: [], count: 0 };
        return acc;
      }, {} as LevelWordLists);
      set(emptyLevelWordLists);
      return;
    }

    const state = $quizStore.quizManager.getState();
    const manager = $quizStore.quizManager;

    // Calculate level word lists
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
  {} as LevelWordLists // Initial value
);
