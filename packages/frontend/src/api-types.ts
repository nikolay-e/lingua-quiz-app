import type { LevelConfigItem } from './lib/config/levelConfig';

export interface User {
  id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WordList {
  listName: string;
  wordCount: number;
}

export interface WordPair {
  sourceText: string;
  sourceLang: string;
  targetText: string;
  targetLang: string;
  listName: string;
  sourceExample?: string;
  targetExample?: string;
}

export interface UserProgress {
  sourceText: string;
  sourceLang: string;
  level: number;
  correctCount: number;
  errorCount: number;
  lastPracticed?: string;
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
