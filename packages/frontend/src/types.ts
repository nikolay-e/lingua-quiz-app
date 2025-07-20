/**
 * Shared type definitions for the LinguaQuiz frontend
 */

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

export interface UserWordSet {
  wordPairId: number;
  sourceWord: string;
  targetWord: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceWordUsageExample?: string;
  targetWordUsageExample?: string;
  status?: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';
}

// API Request/Response types
export interface InitialQuizStateResponse {
  translations: Translation[];
  progress: ProgressEntry[];
  session: {
    id: string;
    direction?: string;
    lastAsked?: number[];
  };
}

// Core quiz types
export interface Translation {
  id: number;
  sourceWord: {
    text: string;
    language: string;
    usageExample?: string;
  };
  targetWord: {
    text: string;
    language: string;
    usageExample?: string;
  };
}

export interface ProgressEntry {
  translationId: number;
  status: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';
  queuePosition: number;
  consecutiveCorrect: number;
  recentHistory: boolean[];
  lastAskedAt?: string;
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
  currentLevel?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
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
