/**
 * @lingua-quiz/core - Core business logic for Lingua Quiz
 *
 * A portable, headless quiz engine that can be used across different platforms:
 * - Web applications (React, Vue, Svelte)
 * - Mobile apps (React Native, NativeScript)
 * - Desktop applications (Electron)
 * - Server-side implementations
 *
 * This package contains NO UI dependencies and focuses purely on business logic.
 */

import {
  F,
  K,
  T_PROMO,
  MISTAKE_THRESHOLD,
  MISTAKE_WINDOW,
  MAX_FOCUS_POOL_SIZE,
  MIN_HISTORY_FOR_DEGRADATION,
} from './constants';
import { checkAnswer, formatForDisplay } from './answer-comparison';
import type { Translation, ProgressEntry } from './types';

export interface QuizQuestion {
  translationId: number;
  questionText: string;
  level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';
  direction: 'normal' | 'reverse';
  sourceLanguage: string;
  targetLanguage: string;
  questionType: 'translation' | 'usage';
  usageExample?: string;
}

export interface SubmissionResult {
  isCorrect: boolean;
  correctAnswerText: string;
  submittedAnswerText: string;
  translation: Translation;
  levelChange?: {
    from: string;
    to: string;
  };
  responseTimeMs?: number;
}

export interface QuizState {
  translations: Translation[];
  progress: ProgressEntry[];
  currentLevel: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
  queues: {
    LEVEL_0: number[];
    LEVEL_1: number[];
    LEVEL_2: number[];
    LEVEL_3: number[];
    LEVEL_4: number[];
    LEVEL_5: number[];
  };
}

export interface QuizOptions {
  maxFocusWords?: number;
  correctAnswersToLevelUp?: number;
  mistakesToLevelDown?: number;
  historySizeForDegradation?: number;
  queuePositionIncrement?: number;
  enableUsageExamples?: boolean;
}

export interface InitialState {
  progress?: ProgressEntry[];
  currentLevel?: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
}

export type LevelStatus = 'LEVEL_0' | 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4' | 'LEVEL_5';
export type PracticeLevel = 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4';
export type QuestionDirection = 'normal' | 'reverse';
export type QuestionType = 'translation' | 'usage';

/**
 * Core quiz engine that manages state, progress tracking, and question generation
 *
 * This is a headless class with no UI dependencies, making it perfectly portable
 * across different platforms and frameworks.
 */
export class QuizManager {
  private translations: Map<number, Translation>;
  private progress: Map<number, ProgressEntry>;
  private queues: {
    LEVEL_0: number[];
    LEVEL_1: number[];
    LEVEL_2: number[];
    LEVEL_3: number[];
    LEVEL_4: number[];
    LEVEL_5: number[];
  };
  private currentLevel: PracticeLevel;
  private opts: Required<QuizOptions>;
  private submissionStartTime: number | null = null;

  /**
   * Creates a new QuizManager instance
   * @param translations - Array of translation pairs
   * @param initialState - Initial state for progress and settings
   * @param options - Configuration options for the quiz behavior
   */
  constructor(translations: Translation[], initialState: InitialState = {}, options: QuizOptions = {}) {
    this.translations = new Map(translations.map((t) => [t.id, t]));
    this.opts = {
      maxFocusWords: options.maxFocusWords ?? MAX_FOCUS_POOL_SIZE,
      correctAnswersToLevelUp: options.correctAnswersToLevelUp ?? T_PROMO,
      mistakesToLevelDown: options.mistakesToLevelDown ?? MISTAKE_THRESHOLD,
      historySizeForDegradation: options.historySizeForDegradation ?? MISTAKE_WINDOW,
      queuePositionIncrement: options.queuePositionIncrement ?? K * F,
      enableUsageExamples: options.enableUsageExamples ?? true,
    };

    // Initialize queues
    this.queues = {
      LEVEL_0: [],
      LEVEL_1: [],
      LEVEL_2: [],
      LEVEL_3: [],
      LEVEL_4: [],
      LEVEL_5: [],
    };

    // Initialize progress and populate queues
    const initialProgressMap = new Map(initialState?.progress?.map((p) => [p.translationId, p]));
    this.progress = new Map();

    translations.forEach((t) => {
      const existing = initialProgressMap.get(t.id);
      const progress: ProgressEntry = existing ?? {
        translationId: t.id,
        level: 'LEVEL_0',
        consecutiveCorrect: 0,
        recentHistory: [],
      };

      this.progress.set(t.id, progress);
      // Add to appropriate queue at the end
      this.queues[progress.level].push(t.id);
    });

    this.currentLevel = initialState?.currentLevel ?? 'LEVEL_1';
    this.replenishFocusPool();
  }

  /**
   * Gets the next question from the current level's queue
   * @returns The next question or null if no questions available, with level adjustment info
   */
  getNextQuestion = (): { question: QuizQuestion | null; levelAdjusted?: boolean; newLevel?: PracticeLevel } => {
    // Check if current level has words available
    if (!this.hasWordsForLevel(this.currentLevel)) {
      // Auto-switch to lowest available level
      const newLevel = this.getLowestAvailablePracticeLevel();
      const levelAdjusted = newLevel !== this.currentLevel;
      this.currentLevel = newLevel;

      // If still no words available anywhere, return null
      if (!this.hasWordsForLevel(this.currentLevel)) {
        return { question: null };
      }

      // Continue with the new level
      if (levelAdjusted) {
        return { question: this.generateQuestion(), levelAdjusted: true, newLevel };
      }
    }

    return { question: this.generateQuestion() };
  };

  /**
   * Generates a question based on current level and available words
   */
  private generateQuestion = (): QuizQuestion | null => {
    // Get words available for current level based on level-specific queues
    let candidateId: number | null = null;

    switch (this.currentLevel) {
      case 'LEVEL_1':
        // LEVEL_1 practices words from LEVEL_0 and LEVEL_1 queues (prioritize LEVEL_1)
        if (this.queues.LEVEL_1.length > 0) {
          candidateId = this.queues.LEVEL_1[0] ?? null;
        } else if (this.queues.LEVEL_0.length > 0) {
          candidateId = this.queues.LEVEL_0[0] ?? null;
        }
        break;
      case 'LEVEL_2':
        // LEVEL_2 practices words from LEVEL_2 queue
        if (this.queues.LEVEL_2.length > 0) {
          candidateId = this.queues.LEVEL_2[0] ?? null;
        }
        break;
      case 'LEVEL_3':
      case 'LEVEL_4':
        // LEVEL_3 and LEVEL_4 practice words from LEVEL_3+ queues (prioritize LEVEL_3)
        if (this.queues.LEVEL_3.length > 0) {
          candidateId = this.queues.LEVEL_3[0] ?? null;
        } else if (this.queues.LEVEL_4.length > 0) {
          candidateId = this.queues.LEVEL_4[0] ?? null;
        } else if (this.queues.LEVEL_5.length > 0) {
          candidateId = this.queues.LEVEL_5[0] ?? null;
        }
        break;
    }

    if (candidateId === null) {
      return null;
    }

    const t = this.translations.get(candidateId);
    const p = this.progress.get(candidateId);
    if (!t || !p) return null;

    // Update last asked time
    p.lastAskedAt = new Date().toISOString();

    // Determine direction and question type based on current level
    const direction = this.getLevelDirection(this.currentLevel);
    const questionType = this.getLevelQuestionType(this.currentLevel);

    // Start timing for response time tracking
    this.submissionStartTime = Date.now();

    return {
      translationId: t.id,
      questionText: direction === 'normal' ? t.sourceText : t.targetText,
      level: this.currentLevel,
      direction,
      sourceLanguage: t.sourceLanguage,
      targetLanguage: t.targetLanguage,
      questionType,
      usageExample: this.getUsageExample(questionType, direction, t),
    };
  };

  /**
   * Sets the current practice level with validation
   * @param level - The desired practice level
   * @returns Object indicating success and any level adjustment made
   */
  setLevel = (level: PracticeLevel): { success: boolean; actualLevel: PracticeLevel; message?: string } => {
    // Check if the requested level has available words
    if (this.hasWordsForLevel(level)) {
      this.currentLevel = level;
      return { success: true, actualLevel: level };
    }

    // If requested level has no words, find the lowest available level
    const lowestAvailable = this.getLowestAvailablePracticeLevel();
    this.currentLevel = lowestAvailable;

    return {
      success: false,
      actualLevel: lowestAvailable,
      message: `${level} has no available words. Switched to ${lowestAvailable}.`,
    };
  };

  /**
   * Determines the direction for a given level
   */
  private getLevelDirection = (level: PracticeLevel): QuestionDirection => {
    return level === 'LEVEL_1' || level === 'LEVEL_3' ? 'normal' : 'reverse';
  };

  /**
   * Determines the question type for a given level
   */
  private getLevelQuestionType = (level: PracticeLevel): QuestionType => {
    return level === 'LEVEL_3' || level === 'LEVEL_4' ? 'usage' : 'translation';
  };

  /**
   * Gets the usage example based on question type and direction
   */
  private getUsageExample = (
    questionType: QuestionType,
    direction: QuestionDirection,
    translation: Translation,
  ): string | undefined => {
    if (questionType !== 'usage') {
      return undefined;
    }
    return direction === 'normal' ? translation.sourceUsageExample : translation.targetUsageExample;
  };

  /**
   * Checks if a practice level has available words
   */
  private hasWordsForLevel = (level: PracticeLevel): boolean => {
    switch (level) {
      case 'LEVEL_1':
        // LEVEL_1 practices words from LEVEL_0 and LEVEL_1 queues
        return this.queues.LEVEL_0.length > 0 || this.queues.LEVEL_1.length > 0;
      case 'LEVEL_2':
        // LEVEL_2 practices words from LEVEL_2 queue
        return this.queues.LEVEL_2.length > 0;
      case 'LEVEL_3':
        // LEVEL_3 practices words from LEVEL_3+ queues
        return this.queues.LEVEL_3.length > 0 || this.queues.LEVEL_4.length > 0 || this.queues.LEVEL_5.length > 0;
      case 'LEVEL_4':
        // LEVEL_4 practices words from LEVEL_3+ queues in reverse
        return this.queues.LEVEL_3.length > 0 || this.queues.LEVEL_4.length > 0 || this.queues.LEVEL_5.length > 0;
      default:
        return false;
    }
  };

  /**
   * Gets the lowest available practice level based on which word queues have content
   * Always prioritizes the natural learning progression: LEVEL_1 → LEVEL_2 → LEVEL_3 → LEVEL_4
   */
  private getLowestAvailablePracticeLevel = (): PracticeLevel => {
    // Check in order of learning progression
    if (this.hasWordsForLevel('LEVEL_1')) return 'LEVEL_1';
    if (this.hasWordsForLevel('LEVEL_2')) return 'LEVEL_2';
    if (this.hasWordsForLevel('LEVEL_3')) return 'LEVEL_3';
    if (this.hasWordsForLevel('LEVEL_4')) return 'LEVEL_4';

    // Fallback to LEVEL_1 if nothing is available
    return 'LEVEL_1';
  };

  /**
   * Submits an answer and updates progress
   * @param translationId - ID of the translation being answered
   * @param userAnswer - The user's submitted answer
   * @returns Result of the submission including correctness and level changes
   */
  submitAnswer = (translationId: number, userAnswer: string): SubmissionResult => {
    const p = this.progress.get(translationId);
    const t = this.translations.get(translationId);
    if (!p || !t) throw new Error('Translation or progress not found');

    // Determine correct answer based on current level's direction
    const direction = this.getLevelDirection(this.currentLevel);
    const correctAnswerText = direction === 'normal' ? t.targetText : t.sourceText;
    const isCorrect = checkAnswer(userAnswer, correctAnswerText);

    // Update recent history
    p.recentHistory = [...p.recentHistory.slice(-this.opts.historySizeForDegradation + 1), isCorrect];

    // Update consecutive correct counter
    p.consecutiveCorrect = isCorrect ? p.consecutiveCorrect + 1 : 0;

    // Calculate response time
    const responseTimeMs = this.submissionStartTime ? Date.now() - this.submissionStartTime : undefined;
    this.submissionStartTime = null;

    const oldStatus = p.level;

    // Update queue position based on answer
    this.updateQueuePosition(translationId, isCorrect);

    // Check for level progression
    this.checkLevelProgression(p);

    this.replenishFocusPool();

    return {
      isCorrect,
      correctAnswerText,
      submittedAnswerText: userAnswer,
      translation: t,
      levelChange: oldStatus !== p.level ? { from: oldStatus, to: p.level } : undefined,
      responseTimeMs,
    };
  };

  /**
   * Updates word's position in queue based on answer correctness
   */
  private updateQueuePosition = (translationId: number, isCorrect: boolean): void => {
    const p = this.progress.get(translationId);
    if (!p) return;

    // Remove from current queue
    const currentQueue = this.queues[p.level];
    const index = currentQueue.indexOf(translationId);
    if (index > -1) {
      currentQueue.splice(index, 1);
    }

    // Calculate new position based on answer correctness
    let newPosition: number;
    if (!isCorrect) {
      // Incorrect answer moves to position F (Focus Loop Size)
      // This ensures quick repetition while maintaining the focus loop size
      newPosition = F;
    } else {
      // Correct answer: position P × T (where T = consecutive correct)
      newPosition = this.opts.queuePositionIncrement * p.consecutiveCorrect;
    }

    // Insert at calculated position (or end if position > queue length)
    const insertIndex = Math.min(newPosition, currentQueue.length);
    currentQueue.splice(insertIndex, 0, translationId);
  };

  /**
   * Checks and updates word level progression
   */
  private checkLevelProgression = (p: ProgressEntry): void => {
    // Check advancement (3 consecutive correct)
    if (p.consecutiveCorrect >= this.opts.correctAnswersToLevelUp) {
      const nextLevel = this.getNextLevel(p.level);
      if (nextLevel) {
        this.moveWordToLevel(p.translationId, nextLevel);
        p.consecutiveCorrect = 0;
      }
      return;
    }

    // Check degradation (3 mistakes in last 10 attempts)
    const recentMistakes = p.recentHistory.filter((h) => !h).length;
    if (recentMistakes >= this.opts.mistakesToLevelDown && p.recentHistory.length >= MIN_HISTORY_FOR_DEGRADATION) {
      const prevLevel = this.getPreviousLevel(p.level);
      if (prevLevel) {
        this.moveWordToLevel(p.translationId, prevLevel);
        p.recentHistory = [];
      }
    }
  };

  /**
   * Gets the next level for progression
   */
  private getNextLevel = (currentLevel: LevelStatus): LevelStatus | null => {
    const levelMap: Record<LevelStatus, LevelStatus> = {
      LEVEL_0: 'LEVEL_1',
      LEVEL_1: 'LEVEL_2',
      LEVEL_2: 'LEVEL_3',
      LEVEL_3: 'LEVEL_4',
      LEVEL_4: 'LEVEL_5',
      LEVEL_5: 'LEVEL_5', // Max level
    };
    return levelMap[currentLevel] === currentLevel ? null : levelMap[currentLevel];
  };

  /**
   * Gets the previous level for degradation
   */
  private getPreviousLevel = (currentLevel: LevelStatus): LevelStatus | null => {
    const levelMap: Record<LevelStatus, LevelStatus> = {
      LEVEL_5: 'LEVEL_4',
      LEVEL_4: 'LEVEL_3',
      LEVEL_3: 'LEVEL_2',
      LEVEL_2: 'LEVEL_1',
      LEVEL_1: 'LEVEL_0',
      LEVEL_0: 'LEVEL_0', // Min level
    };
    return levelMap[currentLevel] === currentLevel ? null : levelMap[currentLevel];
  };

  /**
   * Moves a word from one level to another
   */
  private moveWordToLevel = (translationId: number, newLevel: LevelStatus): void => {
    const p = this.progress.get(translationId);
    if (!p) return;

    // Remove from old queue
    const oldQueue = this.queues[p.level];
    const index = oldQueue.indexOf(translationId);
    if (index > -1) {
      oldQueue.splice(index, 1);
    }

    // Update status and add to new queue at the end
    p.level = newLevel;
    this.queues[newLevel].push(translationId);
  };

  /**
   * Gets the current state of the quiz manager
   * @returns Current quiz state
   */
  getState = (): QuizState => ({
    translations: Array.from(this.translations.values()),
    progress: Array.from(this.progress.values()),
    currentLevel: this.currentLevel,
    queues: this.queues,
  });

  /**
   * Gets a translation by ID
   * @param id - Translation ID
   * @returns Translation or undefined if not found
   */
  getTranslation = (id: number): Translation | undefined => {
    return this.translations.get(id);
  };

  /**
   * Gets a translation formatted for display according to documentation rules
   * @param id - Translation ID
   * @returns Translation with formatted display text or undefined if not found
   */
  getTranslationForDisplay = (id: number): { source: string; target: string } | undefined => {
    const translation = this.translations.get(id);
    if (!translation) return undefined;

    return {
      source: formatForDisplay(translation.sourceText),
      target: formatForDisplay(translation.targetText),
    };
  };

  /**
   * Replenishes the focus pool by promoting words from LEVEL_0 to LEVEL_1
   * @returns Array of translation IDs that were promoted to LEVEL_1
   */
  private replenishFocusPool = (): number[] => {
    // MODIFICATION: Refactored to be more direct and reliable.
    const level1Count = this.queues.LEVEL_1.length;
    const needed = this.opts.maxFocusWords - level1Count;
    if (needed <= 0) return [];

    // Directly take from the front of the LEVEL_0 queue.
    const wordsToPromote = this.queues.LEVEL_0.slice(0, needed);
    for (const translationId of wordsToPromote) {
      // This correctly moves the word from the LEVEL_0 queue to the LEVEL_1 queue.
      this.moveWordToLevel(translationId, 'LEVEL_1');
    }
    return wordsToPromote;
  };

  /**
   * Checks if the quiz is complete (all words at target level)
   * @returns True if quiz is complete
   */
  isQuizComplete = (): boolean => {
    const allProgress = Array.from(this.progress.values());
    if (allProgress.length === 0) return false;

    if (this.opts.enableUsageExamples) {
      // With usage examples enabled, complete means all at LEVEL_5 (Fully Mastered)
      return allProgress.every((p) => p.level === 'LEVEL_5');
    }
    // Without usage examples, complete means all at LEVEL_3 (Translation Mastered Both Ways)
    // LEVEL_3 completes basic translation mastery; LEVEL_4+ are for usage examples
    return allProgress.every((p) => p.level === 'LEVEL_3');
  };

  /**
   * Gets quiz completion percentage
   * @returns Completion percentage (0-100)
   */
  getCompletionPercentage = (): number => {
    const allProgress = Array.from(this.progress.values());
    if (allProgress.length === 0) return 0;

    const targetLevel = this.opts.enableUsageExamples ? 'LEVEL_5' : 'LEVEL_3';
    const completed = allProgress.filter((p) => p.level === targetLevel).length;

    return Math.round((completed / allProgress.length) * 100);
  };

  /**
   * Gets statistics for the current quiz session
   * @returns Quiz statistics
   */
  getStatistics = (): {
    totalWords: number;
    levelCounts: Record<string, number>;
    completionPercentage: number;
    isComplete: boolean;
  } => {
    const allProgress = Array.from(this.progress.values());
    const levelCounts: Record<string, number> = {
      LEVEL_0: 0,
      LEVEL_1: 0,
      LEVEL_2: 0,
      LEVEL_3: 0,
      LEVEL_4: 0,
      LEVEL_5: 0,
    };

    allProgress.forEach((p) => {
      const currentCount = levelCounts[p.level] ?? 0;
      levelCounts[p.level] = currentCount + 1;
    });

    return {
      totalWords: allProgress.length,
      levelCounts,
      completionPercentage: this.getCompletionPercentage(),
      isComplete: this.isQuizComplete(),
    };
  };

  /**
   * Gets current practice level
   */
  getCurrentLevel = (): PracticeLevel => this.currentLevel;

  /**
   * Gets quiz options/configuration
   */
  getOptions = (): Required<QuizOptions> => ({ ...this.opts });

  /**
   * Gets all words grouped by their current level for bulk persistence
   * @returns Map of levels to arrays of translation IDs
   */
  getWordsByLevel = (): Record<LevelStatus, number[]> => {
    return {
      LEVEL_0: [...this.queues.LEVEL_0],
      LEVEL_1: [...this.queues.LEVEL_1],
      LEVEL_2: [...this.queues.LEVEL_2],
      LEVEL_3: [...this.queues.LEVEL_3],
      LEVEL_4: [...this.queues.LEVEL_4],
      LEVEL_5: [...this.queues.LEVEL_5],
    };
  };
}

// Export all modules
export * from './constants';
export * from './answer-comparison';
export * from './types';
// levelConfig moved to frontend package as it contains UI-specific data
