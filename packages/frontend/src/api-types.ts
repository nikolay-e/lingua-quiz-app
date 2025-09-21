/**
 * API-specific type definitions for the LinguaQuiz frontend
 * These types define the contract between the frontend and backend API
 */

import type { LevelStatus } from '@lingua-quiz/core';
import type { LevelConfigItem } from './lib/config/levelConfig';

// User and Authentication types
export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Quiz and Word types
export interface WordSet {
  id: number;
  name: string;
  description?: string;
}

export interface WordSetWithWords extends WordSet {
  words: {
    id: number;
    sourceWord: string;
    targetWord: string;
    sourceLanguage: string;
    targetLanguage: string;
  }[];
}

export interface UserWordSet {
  wordPairId: number;
  sourceWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceWordUsageExample?: string;
  targetWordUsageExample?: string;
  status?: LevelStatus;
}

// API Request/Response types
export interface InitialQuizStateResponse {
  translations: import('@lingua-quiz/core').Translation[];
  progress: import('@lingua-quiz/core').ProgressEntry[];
  session: {
    id: string;
    direction?: string;
    lastAsked?: number[];
  };
}

export interface SubmissionData {
  sessionId: string;
  translationId: number;
  direction: string;
  userAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  levelAtTime: string;
  questionWord: string;
  responseTimeMs?: number;
}

export interface ProgressData {
  translationId: number;
  newStatus: string;
}

export interface SessionData {
  sessionId: string;
  currentLevel?: Exclude<LevelStatus, 'LEVEL_0' | 'LEVEL_5'>;
  lastAsked?: number[];
}

// TTS types
export interface TTSResponse {
  audioData: string;
  contentType: string;
  text: string;
  language: string;
}

export interface TTSLanguagesResponse {
  available: boolean;
  supportedLanguages: string[];
}

// Component-specific types
export interface QuizFeedback {
  message: string;
  isSuccess: boolean;
}

// Level word list types for UI display
export interface LevelWordListItem extends LevelConfigItem {
  words: string[];
  count: number;
}

export interface LevelWordLists {
  [levelId: string]: LevelWordListItem;
}

// Translation display type (for quiz manager getTranslationForDisplay)
export interface TranslationDisplay {
  source: string;
  target: string;
}

// Error handling type for consistent error objects
export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}
