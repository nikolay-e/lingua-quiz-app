/**
 * Level configuration for UI display and behavior
 * Contains icons, labels, and description generators for each level
 * This file handles the presentation layer for quiz levels
 */

import type { LevelStatus } from '@lingua-quiz/core';

export interface LevelConfigItem {
  id: string;
  key: LevelStatus;
  label: string;
  icon: string;
  description: (sourceLanguage: string, targetLanguage: string) => string;
}

export const LEVEL_CONFIG: readonly LevelConfigItem[] = [
  {
    id: 'level0',
    key: 'LEVEL_0',
    label: 'New',
    icon: 'fas fa-list',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `New Words Practice (${sourceLanguage} ➔ ${targetLanguage})`,
  },
  {
    id: 'level1',
    key: 'LEVEL_1',
    label: 'Learning',
    icon: 'fas fa-tasks',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `New Words Practice (${sourceLanguage} ➔ ${targetLanguage})`,
  },
  {
    id: 'level2',
    key: 'LEVEL_2',
    label: 'Translation Mastered One Way',
    icon: 'fas fa-check-circle',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `Reverse Practice (${targetLanguage} ➔ ${sourceLanguage})`,
  },
  {
    id: 'level3',
    key: 'LEVEL_3',
    label: 'Translation Mastered Both Ways',
    icon: 'fas fa-check-circle',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `Context Practice (${sourceLanguage} ➔ ${targetLanguage})`,
  },
  {
    id: 'level4',
    key: 'LEVEL_4',
    label: 'Examples Mastered One Way',
    icon: 'fas fa-star',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `Reverse Context (${targetLanguage} ➔ ${sourceLanguage})`,
  },
  {
    id: 'level5',
    key: 'LEVEL_5',
    label: 'Fully Mastered',
    icon: 'fas fa-trophy',
    description: (sourceLanguage: string, targetLanguage: string) =>
      `Fully Mastered (${sourceLanguage} ⟷ ${targetLanguage})`,
  },
] as const;

/**
 * Helper function to get level configuration by key
 */
export function getLevelConfig(levelKey: LevelStatus): LevelConfigItem | undefined {
  return LEVEL_CONFIG.find((config) => config.key === levelKey);
}

/**
 * Helper function to get level description
 */
export function getLevelDescription(levelKey: LevelStatus, sourceLanguage: string, targetLanguage: string): string {
  const config = getLevelConfig(levelKey);
  return config?.description(sourceLanguage, targetLanguage) || '';
}
