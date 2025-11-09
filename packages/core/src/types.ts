/**
 * Core type definitions for the LinguaQuiz business logic
 * These types are independent of any specific UI or API implementation
 */
export interface Translation {
  id: number;
  sourceText: string;
  sourceLanguage: string;
  sourceUsageExample?: string;
  targetText: string;
  targetLanguage: string;
  targetUsageExample?: string;
}

export interface ProgressEntry {
  translationId: number;
  level: 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';
  consecutiveCorrect: number;
  recentHistory: boolean[];
  lastAskedAt?: string;
}
