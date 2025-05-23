import { writable, get } from 'svelte/store';

import api from './api.js';

// Constants
const STATUS = {
  LEVEL_0: 'LEVEL_0',
  LEVEL_1: 'LEVEL_1',
  LEVEL_2: 'LEVEL_2',
  LEVEL_3: 'LEVEL_3',
};

const MAX_FOCUS_WORDS = 20;
const MAX_LAST_ASKED_WORDS = 7;
const CORRECT_ANSWERS_TO_MASTER = 3;
const MAX_MISTAKES_BEFORE_DEGRADATION = 3;

// Auth Store (unchanged)
function createAuthStore() {
  const { subscribe, set, update } = writable({
    token: localStorage.getItem('token'),
    email: localStorage.getItem('email'),
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
        localStorage.removeItem('email');
        localStorage.removeItem('tokenExpiration');
      }
      return isValid;
    } catch {
      return false;
    }
  };

  update((state) => ({ ...state, isAuthenticated: checkAuth() }));

  setInterval(() => {
    update((state) => ({ ...state, isAuthenticated: checkAuth() }));
  }, 60000);

  return {
    subscribe,
    login: async (email, password) => {
      const data = await api.login(email, password);
      localStorage.setItem('token', data.token);
      localStorage.setItem('email', email);

      // Calculate and store token expiration
      try {
        const payload = JSON.parse(atob(data.token.split('.')[1]));
        const expirationMs = payload.exp * 1000;
        localStorage.setItem('tokenExpiration', expirationMs.toString());
      } catch (e) {
        console.error('Failed to parse token expiration:', e);
      }

      set({ token: data.token, email, isAuthenticated: true });
      return data;
    },
    logout: () => {
      localStorage.removeItem('token');
      localStorage.removeItem('email');
      localStorage.removeItem('tokenExpiration');
      set({ token: null, email: null, isAuthenticated: false });
    },
    register: async (email, password) => {
      return api.register(email, password);
    },
  };
}

// FIXED Quiz Store with Proper Reactivity
function createQuizStore() {
  const { subscribe, set, update } = writable({
    wordSets: [],
    selectedQuiz: null,
    translations: new Map(),
    wordStatusSets: {
      [STATUS.LEVEL_0]: new Set(),
      [STATUS.LEVEL_1]: new Set(),
      [STATUS.LEVEL_2]: new Set(),
      [STATUS.LEVEL_3]: new Set(),
    },
    currentTranslationId: null,
    direction: true,
    lastAskedWords: [],
    consecutiveMistakes: new Map(),
    stats: {
      attemptsPerTranslationIdAndDirection: {},
      incorrectPerTranslationIdAndDirection: {},
    },
    sourceLanguage: '',
    targetLanguage: '',
    loading: false,
    error: null,
  });

  // FIXED: Create new Sets/Maps to trigger reactivity
  const populateFocusWords = (state) => {
    const spacesAvailable = MAX_FOCUS_WORDS - state.wordStatusSets[STATUS.LEVEL_1].size;
    if (spacesAvailable > 0 && state.wordStatusSets[STATUS.LEVEL_0].size > 0) {
      const upcomingWords = Array.from(state.wordStatusSets[STATUS.LEVEL_0]);
      const shuffled = upcomingWords.sort(() => 0.5 - Math.random());
      const wordsToMove = shuffled.slice(0, spacesAvailable);

      // Moving words from LEVEL_0 to LEVEL_1

      // Create new Sets to trigger reactivity
      const newLevel0 = new Set(state.wordStatusSets[STATUS.LEVEL_0]);
      const newLevel1 = new Set(state.wordStatusSets[STATUS.LEVEL_1]);

      // Create new translations Map with updated statuses
      const newTranslations = new Map(state.translations);
      wordsToMove.forEach((wordId) => {
        newLevel0.delete(wordId);
        newLevel1.add(wordId);
        const word = newTranslations.get(wordId);
        if (word) {
          newTranslations.set(wordId, { ...word, status: STATUS.LEVEL_1 });
        }
      });

      // Return new state instead of mutating
      return {
        ...state,
        translations: newTranslations,
        wordStatusSets: {
          ...state.wordStatusSets,
          [STATUS.LEVEL_0]: newLevel0,
          [STATUS.LEVEL_1]: newLevel1,
        },
        moved: wordsToMove.length > 0,
      };
    }
    return state;
  };

  // FIXED: Create new Sets to trigger reactivity
  const moveWordToStatus = (state, wordId, newStatus) => {
    const word = state.translations.get(wordId);
    if (!word || word.status === newStatus) return state;

    // Moving word from old status to new status

    // Create new Sets
    const newWordStatusSets = {};
    Object.entries(state.wordStatusSets).forEach(([status, wordSet]) => {
      newWordStatusSets[status] = new Set(wordSet);
    });

    // Remove from old set and add to new set
    if (newWordStatusSets[word.status]) {
      newWordStatusSets[word.status].delete(wordId);
    }
    newWordStatusSets[newStatus].add(wordId);

    // Create new translations Map with updated status
    const newTranslations = new Map(state.translations);
    newTranslations.set(wordId, { ...word, status: newStatus });

    // Return new state
    return {
      ...state,
      translations: newTranslations,
      wordStatusSets: newWordStatusSets,
      statusChanged: true,
    };
  };

  const selectNextTranslationId = (state, wordSet) => {
    const incorrectCounts = {};
    Object.entries(state.stats.incorrectPerTranslationIdAndDirection).forEach(([key, value]) => {
      const [translationId] = key.split('-');
      incorrectCounts[translationId] = (incorrectCounts[translationId] || 0) + value;
    });

    const sortedWords = Array.from(wordSet).sort((a, b) => {
      const countA = incorrectCounts[a] || 0;
      const countB = incorrectCounts[b] || 0;
      return countB !== countA ? countB - countA : Math.random() - 0.5;
    });

    const topWords = sortedWords.slice(0, 10);
    const availableWords = topWords.filter((id) => !state.lastAskedWords.includes(id));
    const selectionPool = availableWords.length > 0 ? availableWords : topWords;

    return selectionPool[Math.floor(Math.random() * selectionPool.length)];
  };

  const store = {
    subscribe,

    loadWordSets: async (token) => {
      update((state) => ({ ...state, loading: true, error: null }));
      try {
        const wordSets = await api.fetchWordSets(token);
        // Loaded word sets
        update((state) => ({ ...state, wordSets, loading: false }));
      } catch (error) {
        // Error loading word sets
        update((state) => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },

    loadQuiz: async (token, quizName) => {
      update((state) => ({ ...state, loading: true, error: null }));
      try {
        // Loading quiz
        const data = await api.fetchUserWordSets(token, quizName);
        // Quiz data received

        update((state) => {
          const newState = { ...state };
          newState.selectedQuiz = quizName;
          newState.translations = new Map();
          newState.wordStatusSets = {
            [STATUS.LEVEL_0]: new Set(),
            [STATUS.LEVEL_1]: new Set(),
            [STATUS.LEVEL_2]: new Set(),
            [STATUS.LEVEL_3]: new Set(),
          };

          if (data.length > 0) {
            newState.sourceLanguage = data[0].sourceLanguage;
            newState.targetLanguage = data[0].targetLanguage;

            data.forEach((entry) => {
              const status = entry.status || STATUS.LEVEL_0;
              newState.translations.set(entry.wordPairId, { ...entry, status });
              newState.wordStatusSets[status].add(entry.wordPairId);
            });

            // Before populateFocusWords

            const stateAfterPopulate = populateFocusWords(newState);
            Object.assign(newState, stateAfterPopulate);

            // After populateFocusWords
          }

          newState.loading = false;
          return newState;
        });
      } catch (error) {
        // Error loading quiz
        update((state) => ({ ...state, error: error.message, loading: false }));
        throw error;
      }
    },

    getNextQuestion: () => {
      const state = get(quizStore);

      // Auto-toggle direction based on available words
      if (state.direction && state.wordStatusSets[STATUS.LEVEL_1].size === 0 && state.wordStatusSets[STATUS.LEVEL_2].size > 0) {
        // L1 is empty but L2 has words, switch to reverse
        update((s) => ({ ...s, direction: false }));
      } else if (!state.direction && state.wordStatusSets[STATUS.LEVEL_2].size === 0) {
        // L2 is empty, switch back to normal
        update((s) => ({ ...s, direction: true }));
      }

      const updatedState = get(quizStore);
      const primarySet = updatedState.direction ? updatedState.wordStatusSets[STATUS.LEVEL_1] : updatedState.wordStatusSets[STATUS.LEVEL_2];

      let candidateSet = primarySet;
      if (candidateSet.size === 0 && !updatedState.direction) {
        candidateSet = updatedState.wordStatusSets[STATUS.LEVEL_1];
      }

      if (candidateSet.size === 0) {
        if (updatedState.wordStatusSets[STATUS.LEVEL_0].size > 0) {
          update((s) => populateFocusWords(s));
          return store.getNextQuestion();
        }
        return null;
      }

      const nextId = selectNextTranslationId(updatedState, candidateSet);
      const translation = updatedState.translations.get(nextId);

      update((s) => {
        s.currentTranslationId = nextId;
        s.lastAskedWords = [...s.lastAskedWords.filter((id) => id !== nextId), nextId].slice(-MAX_LAST_ASKED_WORDS);
        return s;
      });

      const questionWord = updatedState.direction ? translation.sourceWord : translation.targetWord;

      return { word: questionWord, translationId: nextId };
    },

    submitAnswer: async (userAnswer) => {
      const state = get(quizStore);
      const translation = state.translations.get(state.currentTranslationId);
      if (!translation) return null;

      const correctAnswer = state.direction ? translation.targetWord : translation.sourceWord;

      const normalize = (text) =>
        text
          ?.toLowerCase()
          .normalize('NFD')
          .replace(/\p{M}/gu, '')
          .replace(/[^\p{L}\p{N}\s]/gu, '')
          .replace(/\s+/g, ' ')
          .trim() || '';

      const isCorrect = normalize(userAnswer) === normalize(correctAnswer);
      const directionKey = state.direction ? 'normal' : 'reverse';
      const wordDirectionKey = `${state.currentTranslationId}-${directionKey}`;
      const mistakesKey = wordDirectionKey;

      let statusChanged = false;

      update((s) => {
        let newState = { ...s };

        // Create new stats objects
        newState.stats = {
          ...newState.stats,
          attemptsPerTranslationIdAndDirection: { ...newState.stats.attemptsPerTranslationIdAndDirection },
          incorrectPerTranslationIdAndDirection: { ...newState.stats.incorrectPerTranslationIdAndDirection },
        };

        // Initialize stats if needed
        if (!newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey]) {
          newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
            attempts: 0,
            correct: 0,
            incorrect: 0,
          };
        }

        // Update attempts
        const currentStats = newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey];
        newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
          ...currentStats,
          attempts: (currentStats?.attempts || 0) + 1,
        };

        // Create new consecutive mistakes map
        newState.consecutiveMistakes = new Map(newState.consecutiveMistakes);

        if (isCorrect) {
          // Update correct count
          const currentStats = newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey];
          newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
            ...currentStats,
            correct: (currentStats?.correct || 0) + 1,
          };
          newState.consecutiveMistakes.set(mistakesKey, 0);

          // Get the updated correct count
          const correctCount = newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey].correct;
          const word = newState.translations.get(newState.currentTranslationId);

          // Check for promotion
          if (word.status === STATUS.LEVEL_1 && newState.direction && correctCount >= CORRECT_ANSWERS_TO_MASTER) {
            const updatedState = moveWordToStatus(newState, newState.currentTranslationId, STATUS.LEVEL_2);
            newState = { ...newState, ...updatedState };
            statusChanged = true;
          } else if (word.status === STATUS.LEVEL_2 && !newState.direction && correctCount >= CORRECT_ANSWERS_TO_MASTER) {
            const normalCorrect = newState.stats.attemptsPerTranslationIdAndDirection[`${newState.currentTranslationId}-normal`]?.correct || 0;
            if (normalCorrect >= CORRECT_ANSWERS_TO_MASTER) {
              const updatedState = moveWordToStatus(newState, newState.currentTranslationId, STATUS.LEVEL_3);
              newState = { ...newState, ...updatedState };
              statusChanged = true;
            }
          }
        } else {
          // Update incorrect count
          const currentStats = newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey];
          newState.stats.attemptsPerTranslationIdAndDirection[wordDirectionKey] = {
            ...currentStats,
            incorrect: (currentStats?.incorrect || 0) + 1,
          };

          if (!newState.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey]) {
            newState.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey] = 0;
          }
          newState.stats.incorrectPerTranslationIdAndDirection[wordDirectionKey]++;

          const mistakes = (newState.consecutiveMistakes.get(mistakesKey) || 0) + 1;
          newState.consecutiveMistakes.set(mistakesKey, mistakes);

          // Check for degradation
          if (mistakes >= MAX_MISTAKES_BEFORE_DEGRADATION) {
            const word = newState.translations.get(newState.currentTranslationId);
            const degradeMap = {
              [STATUS.LEVEL_3]: STATUS.LEVEL_2,
              [STATUS.LEVEL_2]: STATUS.LEVEL_1,
              [STATUS.LEVEL_1]: STATUS.LEVEL_0,
            };

            if (degradeMap[word.status]) {
              const updatedState = moveWordToStatus(newState, newState.currentTranslationId, degradeMap[word.status]);
              newState = { ...newState, ...updatedState };
              newState.consecutiveMistakes.set(`${newState.currentTranslationId}-normal`, 0);
              newState.consecutiveMistakes.set(`${newState.currentTranslationId}-reverse`, 0);
              statusChanged = true;
            }
          }
        }

        // If status changed, populate focus words
        if (statusChanged) {
          const updatedState = populateFocusWords(newState);
          newState = { ...newState, ...updatedState };
        }

        return newState;
      });

      // Save state if changed
      if (statusChanged) {
        const { token } = get(authStore);
        const currentState = get(quizStore);
        const word = currentState.translations.get(currentState.currentTranslationId);

        try {
          // Only save the word that changed status
          await api.saveWordStatus(token, word.status, [currentState.currentTranslationId]);
        } catch (error) {
          console.error('Failed to save word status:', error);
          throw new Error('Failed to save quiz state');
        }
      }

      const feedback = isCorrect
        ? { message: 'Correct!', isSuccess: true }
        : {
            message: `Wrong. The correct pair is: '${translation.sourceWord}' ↔ '${translation.targetWord}'`,
            isSuccess: false,
          };

      const usageExamples = {
        source: translation.sourceWordUsageExample || 'No source example available',
        target: translation.targetWordUsageExample || 'No target example available',
      };

      return { feedback, usageExamples, statusChanged };
    },

    toggleDirection: () => {
      update((state) => {
        const canReverse = state.wordStatusSets[STATUS.LEVEL_2].size > 0;
        if (state.direction && canReverse) {
          state.direction = false;
        } else {
          state.direction = true;
        }
        return state;
      });
    },

    reset: () => {
      set({
        wordSets: [],
        selectedQuiz: null,
        translations: new Map(),
        wordStatusSets: {
          [STATUS.LEVEL_0]: new Set(),
          [STATUS.LEVEL_1]: new Set(),
          [STATUS.LEVEL_2]: new Set(),
          [STATUS.LEVEL_3]: new Set(),
        },
        currentTranslationId: null,
        direction: true,
        lastAskedWords: [],
        consecutiveMistakes: new Map(),
        stats: {
          attemptsPerTranslationIdAndDirection: {},
          incorrectPerTranslationIdAndDirection: {},
        },
        sourceLanguage: '',
        targetLanguage: '',
        loading: false,
        error: null,
      });
    },
  };

  return store;
}

export const authStore = createAuthStore();
export const quizStore = createQuizStore();
