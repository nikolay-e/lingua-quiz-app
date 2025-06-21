import { writable, get, type Writable } from 'svelte/store';
import api from './api';
import { QuizManager, type QuizQuestion } from './quiz-core';
import type { WordSet } from './types';

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
  // Check if user has a saved preference, otherwise use system preference
  const getInitialTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    // Check system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const { subscribe, update } = writable({
    isDarkMode: getInitialTheme()
  });

  // Apply theme on initialization
  const applyTheme = (isDark: boolean) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  };

  // Set initial theme
  applyTheme(getInitialTheme());

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e: MediaQueryListEvent) => {
      // Only update if user hasn't set a manual preference
      if (!localStorage.getItem('theme')) {
        const isDark = e.matches;
        applyTheme(isDark);
        update(() => ({ isDarkMode: isDark }));
      }
    });
  }

  return {
    subscribe,
    toggleTheme: () => {
      update(state => {
        const newTheme = !state.isDarkMode;
        const theme = newTheme ? 'dark' : 'light';
        localStorage.setItem('theme', theme);
        applyTheme(newTheme);
        return { isDarkMode: newTheme };
      });
    },
    clearPreference: () => {
      localStorage.removeItem('theme');
      const systemPreference = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      applyTheme(systemPreference);
      update(() => ({ isDarkMode: systemPreference }));
    }
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
  cleanup: () => void;
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  register: (username: string, password: string) => Promise<any>;
}

// Auth Store (unchanged)
function createAuthStore(): AuthStore {
  const { subscribe, set, update } = writable({
    token: localStorage.getItem('token'),
    username: localStorage.getItem('username'),
    isAuthenticated: false,
  });

  const checkAuth = () => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const isValid = payload.exp * 1000 > Date.now() + 60000;
      if (!isValid) {
        localStorage.removeItem('token');
        localStorage.removeItem('username');
        localStorage.removeItem('tokenExpiration');
      }
      return isValid;
    } catch {
      return false;
    }
  };

  update((state) => ({ ...state, isAuthenticated: checkAuth() }));

  let authCheckInterval: NodeJS.Timeout | null = setInterval(() => {
    update((state) => ({ ...state, isAuthenticated: checkAuth() }));
  }, 60000);

  // Cleanup function to clear interval
  const cleanup = () => {
    if (authCheckInterval) {
      clearInterval(authCheckInterval);
      authCheckInterval = null;
    }
  };

  return {
    subscribe,
    cleanup,
    login: async (username: string, password: string) => {
      const data = await api.login(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);

      // Calculate and store token expiration
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expirationMs = payload.exp * 1000;
        localStorage.setItem('tokenExpiration', expirationMs.toString());
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }

      set({ token: data.token, username, isAuthenticated: true });
      return data;
    },
    logout: () => {
      cleanup();
      localStorage.removeItem('token');
      localStorage.removeItem('username');
      localStorage.removeItem('tokenExpiration');
      set({ token: null, username: null, isAuthenticated: false });
    },
    register: async (username: string, password: string) => {
      const data = await api.register(username, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('username', username);

      // Calculate and store token expiration
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expirationMs = payload.exp * 1000;
        localStorage.setItem('tokenExpiration', expirationMs.toString());
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }

      set({ token: data.token, username, isAuthenticated: true });
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
}

interface QuizStore {
  subscribe: Writable<QuizState>['subscribe'];
  loadWordSets: (token: string) => Promise<void>;
  startQuiz: (token: string, quizName: string) => Promise<void>;
  getNextQuestion: () => any | null;
  submitAnswer: (token: string, answer: string) => Promise<any>;
  setLevel: (token: string, level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4') => Promise<{ success: boolean; actualLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; message?: string }>;
  reset: () => void;
}

// Quiz Store with @linguaquiz/core integration
function createQuizStore(): QuizStore {
  const { subscribe, update } = writable({
    wordSets: [],
    selectedQuiz: null,
    quizManager: null,
    currentQuestion: null,
    sessionId: null,
    loading: false,
    error: null
  });

  return {
    subscribe,
    
    loadWordSets: async (token: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const wordSets = await api.fetchWordSets(token);
        update(state => ({ ...state, wordSets, loading: false }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        update(state => ({ ...state, error: message, loading: false }));
        throw error;
      }
    },
    
    startQuiz: async (token: string, quizName: string) => {
      update(state => ({ ...state, loading: true, error: null, selectedQuiz: quizName }));
      try {
        // Use the word-sets API to get translations and progress
        const userWordSets = await api.fetchUserWordSets(token, quizName);
        console.log(`Fetched ${userWordSets.length} words for quiz: ${quizName}`);
        
        // Convert UserWordSet[] to the format expected by QuizManager
        const translations = userWordSets.map(word => ({
          id: word.wordPairId,
          sourceWord: {
            text: word.sourceWord,
            language: word.sourceLanguage,
            usageExample: word.sourceWordUsageExample || ''
          },
          targetWord: {
            text: word.targetWord,
            language: word.targetLanguage,
            usageExample: word.targetWordUsageExample || ''
          }
        }));
        
        const progress = userWordSets.map(word => ({
          translationId: word.wordPairId,
          status: word.status || 'LEVEL_0',  // Use the actual backend status or default to LEVEL_0
          queuePosition: 0,
          consecutiveCorrect: 0,
          recentHistory: []
        }));
        
        const manager = new QuizManager(translations, { 
          progress, 
          currentLevel: 'LEVEL_1'
        });
        console.log('QuizManager initialized with state:', manager.getState());
        
        const questionResult = manager.getNextQuestion();
        const currentQuestion = questionResult.question;
        console.log('First question:', currentQuestion);
        update(state => ({
          ...state,
          loading: false,
          quizManager: manager,
          currentQuestion
        }));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        update(state => ({ ...state, error: message, loading: false }));
        throw error;
      }
    },
    
    getNextQuestion: () => {
      const state = get(quizStore);
      if (!state.quizManager) return null;
      
      const questionResult = state.quizManager.getNextQuestion();
      const question = questionResult.question;
      update(s => ({ ...s, currentQuestion: question }));
      return question;
    },
    
    submitAnswer: async (token: string, answer: string) => {
      const state = get(quizStore);
      if (!state.quizManager || !state.currentQuestion) return null;
      
      try {
        const feedback = state.quizManager.submitAnswer(state.currentQuestion.translationId, answer);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;
        
        // For simplified approach, we only persist level changes using word-sets API
        if (feedback.levelChange) {
          // Update word status in background
          api.saveWordStatus(token, feedback.levelChange.to as any, [feedback.translation.id]).catch(console.error);
        }
        
        // Update UI immediately
        update(s => ({ ...s, currentQuestion: nextQuestion }));
        
        return feedback;
      } catch (error) {
        console.error('Failed to submit answer:', error);
        throw error;
      }
    },
    
    setLevel: async (token: string, level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4') => {
      const state = get(quizStore);
      if (!state.quizManager) {
        return { success: false, actualLevel: 'LEVEL_1', message: 'Quiz not initialized' };
      }
      
      try {
        const result = state.quizManager.setLevel(level);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;
        
        // Update UI immediately
        update(s => ({ ...s, currentQuestion: nextQuestion }));
        
        return result;
      } catch (error) {
        console.error('Failed to set level:', error);
        return { success: false, actualLevel: 'LEVEL_1', message: 'Failed to set level' };
      }
    },
    
    reset: () => {
      update(state => ({
        ...state,
        selectedQuiz: null,
        quizManager: null,
        currentQuestion: null,
        sessionId: null,
        loading: false,
        error: null
      }));
    }
  };
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();