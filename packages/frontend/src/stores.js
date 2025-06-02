import { writable, get } from 'svelte/store';
import api from './api.js';

// Theme Store for dark mode (follows system preference)
function createThemeStore() {
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
  const applyTheme = (isDark) => {
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  };

  // Set initial theme
  applyTheme(getInitialTheme());

  // Listen for system theme changes
  if (window.matchMedia) {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', (e) => {
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

// Auth Store (unchanged)
function createAuthStore() {
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

  let authCheckInterval = setInterval(() => {
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
    login: async (username, password) => {
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
    register: async (username, password) => {
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

// Simplified Quiz Store
function createQuizStore() {
  const { subscribe, update } = writable({
    wordSets: [],
    selectedQuiz: null,
    currentQuestion: null,
    wordLists: {
      level0: [],
      level1: [],
      level2: [],
      level3: []
    },
    direction: 'normal',
    sourceLanguage: '',
    targetLanguage: '',
    loading: false,
    error: null
  });

  return {
    subscribe,
    
    loadWordSets: async (token) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const wordSets = await api.fetchWordSets(token);
        update(state => ({ ...state, wordSets, loading: false }));
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    startQuiz: async (token, quizName) => {
      update(state => ({ ...state, loading: true, error: null, selectedQuiz: quizName }));
      try {
        const data = await api.startQuiz(token, quizName);
        update(state => ({
          ...state,
          loading: false,
          direction: data.direction,
          sourceLanguage: data.sourceLanguage,
          targetLanguage: data.targetLanguage,
          wordLists: data.wordLists
        }));
      } catch (error) {
        update(state => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },
    
    getNextQuestion: async (token) => {
      const state = get(quizStore);
      if (!state.selectedQuiz) return null;
      
      try {
        const question = await api.getNextQuestion(token, state.selectedQuiz);
        if (question && question.error) {
          // No more questions available - this is not an error
          update(s => ({ ...s, currentQuestion: null }));
          return null;
        }
        update(s => ({ ...s, currentQuestion: question }));
        return question;
      } catch (error) {
        console.error('Failed to get next question:', error);
        update(s => ({ ...s, currentQuestion: null }));
        return null;
      }
    },
    
    submitAnswer: async (token, answer) => {
      const state = get(quizStore);
      if (!state.currentQuestion || !state.selectedQuiz) return null;
      
      // Capture the current question details before making the API call
      const currentTranslationId = state.currentQuestion.translationId;
      const displayedWord = state.currentQuestion.word;
      
      try {
        const result = await api.submitAnswer(
          token, 
          state.selectedQuiz,
          currentTranslationId, 
          answer,
          displayedWord
        );
        
        // Handle session mismatch error from backend
        if (result.error && result.needsRefresh) {
          console.warn('Session mismatch detected, refreshing current question');
          // Force refresh of current question
          const question = await api.getNextQuestion(token, state.selectedQuiz);
          update(s => ({ ...s, currentQuestion: question }));
          throw new Error(result.error);
        }
        
        // Update word lists and next question from result
        if (result.wordLists) {
          const updates = { wordLists: result.wordLists };
          
          // Use next question from submit response if available
          if (result.nextQuestion) {
            if (result.nextQuestion.error) {
              // No more questions available
              updates.currentQuestion = null;
            } else {
              updates.currentQuestion = result.nextQuestion;
            }
          }
          
          update(s => ({ ...s, ...updates }));
        }
        
        return result;
      } catch (error) {
        console.error('Failed to submit answer:', error);
        throw error;
      }
    },
    
    toggleDirection: async (token) => {
      const state = get(quizStore);
      if (!state.selectedQuiz) return;
      
      try {
        const result = await api.toggleDirection(token, state.selectedQuiz);
        const updates = { direction: result.direction };
        if (result.wordLists) {
          updates.wordLists = result.wordLists;
        }
        update(s => ({ ...s, ...updates }));
      } catch (error) {
        console.error('Failed to toggle direction:', error);
      }
    },
    
    reset: () => {
      update(state => ({
        ...state,
        selectedQuiz: null,
        currentQuestion: null,
        wordLists: {
          level0: [],
          level1: [],
          level2: [],
          level3: []
        },
        direction: 'normal',
        sourceLanguage: '',
        targetLanguage: '',
        loading: false,
        error: null
      }));
    }
  };
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();