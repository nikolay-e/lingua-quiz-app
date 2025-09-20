import { writable, get, type Writable } from 'svelte/store';
import api from './api';
import { QuizManager, type QuizQuestion } from '@lingua-quiz/core';
import type { WordSet } from '@lingua-quiz/core';

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
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const { subscribe, set, update } = writable({
    isDarkMode: getInitialTheme(),
  });

  const applyTheme = (isDark: boolean) => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    }
  };

  // Apply initial theme
  applyTheme(getInitialTheme());

  // Listen for system theme changes
  if (typeof window !== 'undefined' && window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
      if (!localStorage.getItem('theme')) {
        const isDark = e.matches;
        applyTheme(isDark);
        // Use `set` to avoid creating orphaned effects
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
          localStorage.setItem('theme', newTheme ? 'dark' : 'light');
        }
        applyTheme(newTheme);
        return { isDarkMode: newTheme };
      });
    },
    clearPreference: () => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem('theme');
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
  login: (username: string, password: string) => Promise<{ token: string; username: string }>;
  logout: () => void;
  register: (username: string, password: string) => Promise<{ token: string; username: string }>;
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

    const token = localStorage.getItem('token');
    const username = localStorage.getItem('username');

    if (!token || !username) {
      set({ token: null, username: null, isAuthenticated: false });
      return;
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isExpired = payload.exp * 1000 < Date.now();

      if (isExpired) {
        logoutUser(); // Token is expired, log out
      } else {
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
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', data.username);

      // Calculate and store token expiration
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expirationMs = payload.exp * 1000;
        localStorage.setItem('tokenExpiration', expirationMs.toString());
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }
    }
    set({ token: data.token, username: data.username, isAuthenticated: true });
  }

  // Function to clear user data
  function logoutUser() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('tokenExpiration');
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
      setUser({ token: data.token, username });
      return data;
    },
    logout: () => {
      logoutUser();
    },
    register: async (username: string, password: string) => {
      const data = await api.register(username, password);
      setUser({ token: data.token, username });
      return data;
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
  autoSaveTimer: ReturnType<typeof setTimeout> | null;
}

interface QuizStore {
  subscribe: Writable<QuizState>['subscribe'];
  loadWordSets: (token: string) => Promise<void>;
  startQuiz: (token: string, quizName: string) => Promise<void>;
  getNextQuestion: () => QuizQuestion | null;
  submitAnswer: (token: string, answer: string) => Promise<{ isCorrect: boolean; correctAnswer?: string } | null>;
  setLevel: (
    level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'
  ) => Promise<{ success: boolean; actualLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; message?: string }>;
  reset: () => void;
  saveAndCleanup: (token: string) => Promise<void>;
}

// Quiz Store with @lingua-quiz/core integration
function createQuizStore(): QuizStore {
  const { subscribe, set, update } = writable({
    wordSets: [],
    selectedQuiz: null,
    quizManager: null,
    currentQuestion: null,
    sessionId: null,
    loading: false,
    error: null,
    autoSaveTimer: null,
  });

  const BULK_SAVE_DELAY = 5000; // 5 seconds

  const bulkSaveProgress = async (token: string) => {
    const state = get(store);
    if (!state.quizManager) return;

    // Bulk saving quiz progress

    try {
      const wordsByLevel = state.quizManager.getWordsByLevel();
      const persistencePromises: Promise<void>[] = [];

      for (const [level, wordIds] of Object.entries(wordsByLevel)) {
        const wordArray = wordIds as number[];
        if (wordArray.length > 0) {
          persistencePromises.push(
            api
              .saveWordStatus(token, level as 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5', wordArray)
              .catch((err) => console.error(`Bulk save failed for ${level}:`, err))
          );
        }
      }

      if (persistencePromises.length > 0) {
        await Promise.all(persistencePromises);
        // Bulk save completed successfully
      }
    } catch (error) {
      console.error('Bulk save error:', error);
    }
  };

  const scheduleBulkSave = (token: string) => {
    const state = get(store);

    // Clear existing timer
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
    }

    // Schedule new bulk save
    const timer = setTimeout(() => bulkSaveProgress(token), BULK_SAVE_DELAY);

    // Update state with new timer
    update((s) => ({ ...s, autoSaveTimer: timer }));
  };

  const store = {
    subscribe,

    loadWordSets: async (token: string) => {
      update((state) => ({ ...state, loading: true, error: null }));
      try {
        const wordSets = await api.fetchWordSets(token);
        // Use set/get pattern after await to avoid orphaned effects
        set({ ...get(store), wordSets, loading: false });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        // Use set/get pattern after await to avoid orphaned effects
        set({ ...get(store), error: message, loading: false });
        throw error;
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

        // Use set/get pattern after await to avoid orphaned effects
        set({
          ...get(store),
          loading: false,
          quizManager: manager,
          currentQuestion,
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        // Use set/get pattern after await to avoid orphaned effects
        set({ ...get(store), error: message, loading: false });
        throw error;
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

        // If level changed automatically, persist it
        if (oldLevel !== newLevel) {
          try {
            await api.updateCurrentLevel(token, newLevel);
            // Auto level change persisted
          } catch (error) {
            console.error('Failed to persist level change:', error);
          }
        }

        // Schedule bulk save after any answer (removed immediate level change saves)
        scheduleBulkSave(token);

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
        return { success: false, actualLevel: 'LEVEL_1', message: 'Quiz not initialized' };
      }

      try {
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
        return { success: false, actualLevel: 'LEVEL_1', message: 'Failed to set level' };
      }
    },

    reset: () => {
      const state = get(store);
      if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
      }
      set({
        wordSets: state.wordSets, // Keep the loaded word sets
        selectedQuiz: null,
        quizManager: null,
        currentQuestion: null,
        sessionId: null,
        loading: false,
        error: null,
        autoSaveTimer: null,
      });
    },

    saveAndCleanup: async (token: string) => {
      const state = get(store);
      // Clear any pending save timer
      if (state.autoSaveTimer) {
        clearTimeout(state.autoSaveTimer);
      }
      // Save current progress
      if (state.quizManager) {
        await bulkSaveProgress(token);
      }
    },
  };

  return store;
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();
