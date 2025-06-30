import { writable, get, type Writable } from 'svelte/store';
import api from './api';
import { QuizManager, type QuizQuestion } from '@linguaquiz/core';
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
  const getInitialTheme = () => {
    if (typeof window === 'undefined') return false;
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  };

  const { subscribe, set, update } = writable({
    isDarkMode: getInitialTheme()
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
      update(state => {
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
  login: (username: string, password: string) => Promise<any>;
  logout: () => void;
  register: (username: string, password: string) => Promise<any>;
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
    } catch (e) {
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
  getNextQuestion: () => any | null;
  submitAnswer: (token: string, answer: string) => Promise<any>;
  setLevel: (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4') => Promise<{ success: boolean; actualLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; message?: string }>;
  reset: () => void;
}

// Quiz Store with @linguaquiz/core integration
function createQuizStore(): QuizStore {
  const { subscribe, set, update } = writable({
    wordSets: [],
    selectedQuiz: null,
    quizManager: null,
    currentQuestion: null,
    sessionId: null,
    loading: false,
    error: null,
    autoSaveTimer: null
  });

  const AUTO_SAVE_DELAY = 30000; // 30 seconds
  
  const scheduleAutoSave = (token: string) => {
    const state = get(store);
    
    // Clear existing timer
    if (state.autoSaveTimer) {
      clearTimeout(state.autoSaveTimer);
    }
    
    // Schedule new auto-save
    const timer = setTimeout(async () => {
      const currentState = get(store);
      if (!currentState.quizManager) return;
      
      console.log('Auto-saving quiz state after 30 seconds of inactivity...');
      
      try {
        // Get all words grouped by level from QuizManager
        const wordsByLevel = currentState.quizManager.getWordsByLevel();
        const persistencePromises: Promise<any>[] = [];
        
        // Save each level's words
        for (const [level, wordIds] of Object.entries(wordsByLevel)) {
          const wordArray = wordIds as number[];
          if (wordArray.length > 0) {
            persistencePromises.push(
              api.saveWordStatus(token, level as any, wordArray)
                .catch(err => console.error(`Auto-save failed for ${level}:`, err))
            );
          }
        }
        
        if (persistencePromises.length > 0) {
          await Promise.all(persistencePromises);
          console.log('Auto-save completed successfully');
        }
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, AUTO_SAVE_DELAY);
    
    // Update state with new timer
    update(s => ({ ...s, autoSaveTimer: timer }));
  };
  
  const store = {
    subscribe,
    
    loadWordSets: async (token: string) => {
      update(state => ({ ...state, loading: true, error: null }));
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
          status: (word.status || 'LEVEL_0') as 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5',
          queuePosition: 0,
          consecutiveCorrect: 0,
          recentHistory: [] as boolean[]
        }));
        
        const manager = new QuizManager(translations, { 
          progress, 
          currentLevel: 'LEVEL_1'
        });
        console.log('QuizManager initialized with state:', manager.getState());
        
        // Persist all current levels after initialization (handles promotions from LEVEL_0 to LEVEL_1)
        const wordsByLevel = manager.getWordsByLevel();
        const persistencePromises: Promise<any>[] = [];
        
        // Compare with original progress to find changes
        const originalLevels = new Map(progress.map(p => [p.translationId, p.status]));
        
        for (const [level, wordIds] of Object.entries(wordsByLevel)) {
          // Find words that changed to this level
          const changedWords = wordIds.filter(id => originalLevels.get(id) !== level);
          
          if (changedWords.length > 0) {
            console.log(`Persisting ${changedWords.length} words that changed to ${level}`);
            persistencePromises.push(
              api.saveWordStatus(token, level as any, changedWords)
                .catch(err => console.error(`Failed to persist ${level}:`, err))
            );
          }
        }
        
        // Wait for all persistence operations to complete
        if (persistencePromises.length > 0) {
          await Promise.all(persistencePromises);
          console.log('Level persistence completed');
        }
        
        const questionResult = manager.getNextQuestion();
        const currentQuestion = questionResult.question;
        console.log('First question:', currentQuestion);
        
        // Use set/get pattern after await to avoid orphaned effects
        set({
          ...get(store),
          loading: false,
          quizManager: manager,
          currentQuestion
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
      update(s => ({ ...s, currentQuestion: question }));
      return question;
    },
    
    submitAnswer: async (token: string, answer: string) => {
      const state = get(store);
      if (!state.quizManager || !state.currentQuestion) return null;
      
      try {
        const feedback = state.quizManager.submitAnswer(state.currentQuestion.translationId, answer);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;
        
        // For simplified approach, we only persist level changes using word-sets API
        if (feedback.levelChange) {
          // levelChange.to already contains the full level string (e.g., 'LEVEL_2')
          const levelString = feedback.levelChange.to;
          // Wait for persistence to complete before updating UI to avoid race conditions
          await api.saveWordStatus(token, levelString as any, [feedback.translation.id]);
        }
        
        // Use set/get pattern after await to avoid orphaned effects
        set({ ...get(store), currentQuestion: nextQuestion });
        
        // Schedule auto-save after user activity
        scheduleAutoSave(token);
        
        return feedback;
      } catch (error) {
        console.error('Failed to submit answer:', error);
        throw error;
      }
    },
    
    setLevel: async (level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4') => {
      const state = get(store);
      if (!state.quizManager) {
        return { success: false, actualLevel: 'LEVEL_1', message: 'Quiz not initialized' };
      }
      
      try {
        const result = state.quizManager.setLevel(level);
        const questionResult = state.quizManager.getNextQuestion();
        const nextQuestion = questionResult.question;
        
        // Update UI immediately (this is synchronous, so update is fine)
        update(s => ({ ...s, currentQuestion: nextQuestion }));
        
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
        autoSaveTimer: null
      });
    }
  };
  
  return store;
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();