/**
 * Application constants to eliminate magic strings and provide type safety
 */

// Page navigation constants
export const PAGES = {
  LOGIN: 'login',
  REGISTER: 'register',
} as const;

export type PageType = (typeof PAGES)[keyof typeof PAGES];

// Level constants - import from core where they're already defined
export type { LevelStatus } from '@lingua-quiz/core';

// Default level constants
export const DEFAULT_LEVEL = 'LEVEL_1' as const;

// Event names for consistent dispatching
export const EVENTS = {
  NAVIGATE: 'navigate',
  SELECT: 'select',
  BACK_TO_MENU: 'backToMenu',
  TOGGLE_FOLD: 'toggleFold',
  PLAY_TTS: 'playTTS',
} as const;

export type EventType = (typeof EVENTS)[keyof typeof EVENTS];

// API endpoints base paths (for consistency)
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    DELETE_ACCOUNT: '/auth/delete-account',
  },
  WORD_SETS: '/word-sets',
  USER: {
    CURRENT_LEVEL: '/user/current-level',
  },
  TTS: {
    SYNTHESIZE: '/tts/synthesize',
    LANGUAGES: '/tts/languages',
  },
} as const;

// Storage keys for localStorage
export const STORAGE_KEYS = {
  TOKEN: 'token',
  USERNAME: 'username',
  TOKEN_EXPIRATION: 'tokenExpiration',
  THEME: 'theme',
  FOLDED_LISTS: 'foldedLists',
} as const;

// Theme constants
export const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export type ThemeType = (typeof THEMES)[keyof typeof THEMES];
