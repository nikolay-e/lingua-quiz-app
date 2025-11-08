import type { LevelStatus, Translation, ProgressEntry } from '@lingua-quiz/core';
import type { LevelConfigItem } from './lib/config/levelConfig';

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

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

export interface InitialQuizStateResponse {
  translations: Translation[];
  progress: ProgressEntry[];
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

export interface QuizFeedback {
  message: string;
  isSuccess: boolean;
}

export interface LevelWordListItem extends LevelConfigItem {
  words: string[];
  count: number;
}

export interface LevelWordLists {
  [levelId: string]: LevelWordListItem;
}

export interface TranslationDisplay {
  source: string;
  target: string;
}

export interface AppError {
  message: string;
  code?: string;
  details?: unknown;
}
