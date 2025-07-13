/**
 * @linguaquiz/core - Core business logic for Lingua Quiz
 * 
 * A portable, headless quiz engine that can be used across different platforms:
 * - Web applications (React, Vue, Svelte)
 * - Mobile apps (React Native, NativeScript)
 * - Desktop applications (Electron)
 * - Server-side implementations
 * 
 * This package contains NO UI dependencies and focuses purely on business logic.
 */

import { F, K, T_PROMO, MISTAKE_THRESHOLD, MISTAKE_WINDOW, MAX_FOCUS_POOL_SIZE, RECENTLY_ASKED_SIZE, MIN_HISTORY_FOR_DEGRADATION } from './constants';

/* --------------------------------------------------
 * Normalisation helpers
 * -------------------------------------------------- */

// Mapping of visually close Latin → Cyrillic characters when the string is
// clearly meant to be Cyrillic (avoids accidental Latin input).
const latinToCyrillic: Record<string, string> = {
  c: 'с', C: 'С', p: 'р', P: 'Р', o: 'о', O: 'О', a: 'а', A: 'А',
  e: 'е', E: 'Е', x: 'х', X: 'Х', y: 'у', Y: 'У', k: 'к', K: 'К',
  h: 'н', H: 'Н', m: 'м', M: 'М', t: 'т', T: 'Т', b: 'в', B: 'В',
  i: 'і', I: 'І', z: 'з', Z: 'З', d: 'д', D: 'Д', g: 'г', G: 'Г',
  l: 'л', L: 'Л', n: 'н', N: 'Н', r: 'р', R: 'Р', s: 'с', S: 'С',
  f: 'ф', F: 'Ф'
};

/** Remove diacritics from the Latin script (NFD → strip marks). */
const stripLatinDiacritics = (s: string): string =>
  s.normalize('NFD').replace(/\p{M}/gu, '');

/** Collapse German umlaut/ß variants to a single form for comparison. */
const collapseGerman = (s: string): string => {
  return s
    // 1. Single‑character umlauts → plain vowel.
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/Ä/g, 'a').replace(/Ö/g, 'o').replace(/Ü/g, 'u')
    .replace(/ß/g, 'ss')
    // 2. Two‑character replacements (ae/oe/ue) → same plain vowel.
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
};

/** Full script‑/accent‑aware canonicalisation used for matching logic. */
export const normalizeForComparison = (text: string): string => {
  if (!text) return '';
  let result = text;

  // 1. Trim + lower + remove all whitespace (spaces are ignored).
  result = result.trim().toLowerCase().replace(/\s+/g, '');

  // 2. Cyrillic ё ⇢ е mapping (always, never harmful).
  result = result.replace(/ё/g, 'е');

  // 3. Handle Latin → Cyrillic substitution only when clearly in a Cyrillic
  //    context to avoid mangling Spanish/German inputs.
  const containsCyr = /[а-я]/i.test(result);
  const looksLikeFakeCyr = /^[acopextmhsrpl]+$/i.test(result);
  if (containsCyr || looksLikeFakeCyr) {
    result = result.replace(/[A-Za-z]/g, ch => latinToCyrillic[ch] || ch);
  }

  // 4. German & Spanish (plus general Latin) accent handling.
  result = collapseGerman(stripLatinDiacritics(result));

  return result;
};

/** Shorthand that callers use everywhere. */
export const normalize = (text: string): string => normalizeForComparison(text);

/* --------------------------------------------------
 * formatForDisplay
 * -------------------------------------------------- */

// Sentinel to mask pipes inside square brackets so we can safely split later.
const PIPE_SENTINEL = '§§PIPE§§';

/**
 * Render stored translation for UI according to docs:
 *   – show only first alt of any pipe list
 *   – if pipes inside parentheses → first alt, remove the parentheses
 *   – keep commas intact, [] intact
 */
export const formatForDisplay = (input: string): string => {
  if (!input) return input;
  let text = input;

  // 1. Replace each ( ... ) group containing a pipe with its first alternative.
  text = text.replace(/\(([^)]+)\)/g, (match, inner) => {
    if (!inner.includes('|')) return match; // leave untouched.
    const firstAlt = inner.split('|').map((s: string) => s.trim()).find((s: string) => s) || '';
    return firstAlt; // drop surrounding parentheses.
  });

  // Remove any leftover empty parentheses "()" (possibly multiple).
  while (/\(\s*\)/.test(text)) text = text.replace(/\(\s*\)/g, '');

  // 2. Temporarily mask pipes inside square brackets so we don't treat them as
  //    synonym separators.
  text = text.replace(/\[[^\]]*\]/g, br => br.replace(/\|/g, PIPE_SENTINEL));

  // 3. For any remaining standalone pipes, keep only the segment before the
  //    first one.
  if (text.includes('|')) {
    text = text.split('|')[0].trim();
  }

  // 4. Unmask bracket pipes and tidy up whitespace / commas.
  text = text.replace(new RegExp(PIPE_SENTINEL, 'g'), '|')
    .replace(/\s*,\s*/g, ', ')   // single space after comma.
    .replace(/\s+/g, ' ')       // collapse runs of spaces.
    .trim()
    .replace(/^,\s*/, '')        // no leading commas
    .replace(/\s*,\s*$/, '');    // no trailing commas.

  return text;
};

/* --------------------------------------------------
 * checkAnswer – heavy‑duty matcher
 * -------------------------------------------------- */

type AltSet = Set<string>; // Normalised alternatives allowed for ONE meaning group.

/** Split by top‑level commas (commas not nested in () or []). */
const splitTopLevelCommas = (s: string): string[] => {
  const parts: string[] = [];
  let current = '';
  let depthPar = 0;
  let depthBr = 0;
  for (const ch of s) {
    if (ch === '(') depthPar++;
    else if (ch === ')') depthPar = Math.max(0, depthPar - 1);
    else if (ch === '[') depthBr++;
    else if (ch === ']') depthBr = Math.max(0, depthBr - 1);

    if (ch === ',' && depthPar === 0 && depthBr === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
};

/** Expand one meaning‑group string (which may hold pipes + brackets) into all
 *  acceptable raw alternatives (still UNnormalized). */
const expandGroup = (group: string): string[] => {
  let g = group.trim();

  // 1. Strip outer parentheses *if* they wrap the whole group and contain pipes.
  if (g.startsWith('(') && g.endsWith(')') && g.includes('|')) {
    g = g.slice(1, -1);
  }

  const bracketMatch = g.match(/^(.*?)(\[(.*?)\])(.*)$/);
  let baseVariants: string[] = [];
  if (bracketMatch) {
    const pre = bracketMatch[1];
    const opt = bracketMatch[3];
    const post = bracketMatch[4];
    // With whitespace removal in normalize(), we only need to generate logical combinations.
    baseVariants.push(`${pre}${opt}${post}`);
    baseVariants.push(`${pre}${post}`);
  } else {
    baseVariants = [g];
  }

  // Finally, split any pipes inside each base variant.
  const alts: string[] = [];
  baseVariants.forEach(b => {
    if (b.includes('|')) {
      b.split('|').forEach(p => {
        const t = p.trim();
        if (t) alts.push(t);
      });
    } else if (b) {
      alts.push(b);
    }
  });

  return Array.from(new Set(alts)); // unique
};

/** Build an array of acceptable alternative sets for every meaning group. */
const buildGroups = (correct: string): AltSet[] => {
  const groups = splitTopLevelCommas(correct);
  return groups.map(g => {
    const set: AltSet = new Set(expandGroup(g).map((n: string) => normalize(n)));
    // Add the un-expanded normalized group as well for simple cases
    const normalizedGroup = normalize(g);
    if (normalizedGroup) set.add(normalizedGroup);
    return set;
  });
};

/** Core public matcher. */
export const checkAnswer = (userAnswer: string, correctAnswer: string): boolean => {
  // Early true if BOTH empty after normalization.
  if (normalize(userAnswer) === '' && normalize(correctAnswer) === '') return true;

  const correctGroups = buildGroups(correctAnswer);

  // If pattern has only one group & no commas, we can treat pipes/brackets only.
  if (correctGroups.length === 1) {
    return correctGroups[0].has(normalize(userAnswer));
  }

  // Multi‑meaning answer – user must supply same number of comma parts in any order.
  const userTokens = splitTopLevelCommas(userAnswer).map((t: string) => normalize(t));
  if (userTokens.length !== correctGroups.length) return false;

  const used = new Set<number>();
  for (const token of userTokens) {
    let matched = false;
    for (let i = 0; i < correctGroups.length; i++) {
      if (used.has(i)) continue;
      if (correctGroups[i].has(token)) {
        used.add(i);
        matched = true;
        break;
      }
    }
    if (!matched) return false; // token didn't fit any group.
  }
  return true;
};

// Core interfaces and types
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
  recentlyAskedSize?: number;
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
    this.translations = new Map(translations.map(t => [t.id, t]));
    this.opts = {
      maxFocusWords: options.maxFocusWords ?? MAX_FOCUS_POOL_SIZE,
      correctAnswersToLevelUp: options.correctAnswersToLevelUp ?? T_PROMO,
      mistakesToLevelDown: options.mistakesToLevelDown ?? MISTAKE_THRESHOLD,
      historySizeForDegradation: options.historySizeForDegradation ?? MISTAKE_WINDOW,
      recentlyAskedSize: options.recentlyAskedSize ?? RECENTLY_ASKED_SIZE,
      queuePositionIncrement: options.queuePositionIncrement ?? (K * F),
      enableUsageExamples: options.enableUsageExamples ?? true,
    };

    // Initialize queues
    this.queues = {
      LEVEL_0: [],
      LEVEL_1: [],
      LEVEL_2: [],
      LEVEL_3: [],
      LEVEL_4: [],
      LEVEL_5: []
    };
    
    // Initialize progress and populate queues
    const initialProgressMap = new Map(initialState?.progress?.map(p => [p.translationId, p]));
    this.progress = new Map();
    
    translations.forEach(t => {
      const existing = initialProgressMap.get(t.id);
      const progress: ProgressEntry = existing || {
        translationId: t.id,
        status: 'LEVEL_0',
        queuePosition: 0,
        consecutiveCorrect: 0,
        recentHistory: []
      };
      
      this.progress.set(t.id, progress);
      // Add to appropriate queue at the end
      this.queues[progress.status].push(t.id);
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
  }

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
          candidateId = this.queues.LEVEL_1[0];
        } else if (this.queues.LEVEL_0.length > 0) {
          candidateId = this.queues.LEVEL_0[0];
        }
        break;
      case 'LEVEL_2':
        // LEVEL_2 practices words from LEVEL_2 queue
        if (this.queues.LEVEL_2.length > 0) {
          candidateId = this.queues.LEVEL_2[0];
        }
        break;
      case 'LEVEL_3':
      case 'LEVEL_4':
        // LEVEL_3 and LEVEL_4 practice words from LEVEL_3+ queues (prioritize LEVEL_3)
        if (this.queues.LEVEL_3.length > 0) {
          candidateId = this.queues.LEVEL_3[0];
        } else if (this.queues.LEVEL_4.length > 0) {
          candidateId = this.queues.LEVEL_4[0];
        } else if (this.queues.LEVEL_5.length > 0) {
          candidateId = this.queues.LEVEL_5[0];
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
      questionText: direction === 'normal' ? t.sourceWord.text : t.targetWord.text,
      level: this.currentLevel,
      direction,
      sourceLanguage: t.sourceWord.language,
      targetLanguage: t.targetWord.language,
      questionType,
      usageExample: questionType === 'usage' ? 
        (direction === 'normal' ? t.sourceWord.usageExample : t.targetWord.usageExample) : 
        undefined
    };
  }
  
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
      message: `${level} has no available words. Switched to ${lowestAvailable}.`
    };
  }
  
  /**
   * Determines the direction for a given level
   */
  private getLevelDirection = (level: PracticeLevel): QuestionDirection => {
    return level === 'LEVEL_1' || level === 'LEVEL_3' ? 'normal' : 'reverse';
  }
  
  /**
   * Determines the question type for a given level
   */
  private getLevelQuestionType = (level: PracticeLevel): QuestionType => {
    return level === 'LEVEL_3' || level === 'LEVEL_4' ? 'usage' : 'translation';
  }
  

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
  }

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
  }

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
    const correctAnswerText = direction === 'normal' ? t.targetWord.text : t.sourceWord.text;
    const isCorrect = checkAnswer(userAnswer, correctAnswerText);

    // Update recent history
    p.recentHistory = [...p.recentHistory.slice(-this.opts.historySizeForDegradation + 1), isCorrect];
    
    // Update consecutive correct counter
    p.consecutiveCorrect = isCorrect ? p.consecutiveCorrect + 1 : 0;
    
    // Calculate response time
    const responseTimeMs = this.submissionStartTime ? Date.now() - this.submissionStartTime : undefined;
    this.submissionStartTime = null;
    
    const oldStatus = p.status;
    
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
      levelChange: oldStatus !== p.status ? { from: oldStatus, to: p.status } : undefined,
      responseTimeMs
    };
  }

  /**
   * Updates word's position in queue based on answer correctness
   */
  private updateQueuePosition = (translationId: number, isCorrect: boolean): void => {
    const p = this.progress.get(translationId);
    if (!p) return;
    
    // Remove from current queue
    const currentQueue = this.queues[p.status];
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
  }

  /**
   * Checks and updates word level progression
   */
  private checkLevelProgression = (p: ProgressEntry): void => {
    // Check advancement (3 consecutive correct)
    if (p.consecutiveCorrect >= this.opts.correctAnswersToLevelUp) {
      const nextLevel = this.getNextLevel(p.status);
      if (nextLevel) {
        this.moveWordToLevel(p.translationId, nextLevel);
        p.consecutiveCorrect = 0;
      }
      return;
    }
    
    // Check degradation (3 mistakes in last 10 attempts)
    const recentMistakes = p.recentHistory.filter(h => !h).length;
    if (recentMistakes >= this.opts.mistakesToLevelDown && p.recentHistory.length >= MIN_HISTORY_FOR_DEGRADATION) {
      const prevLevel = this.getPreviousLevel(p.status);
      if (prevLevel) {
        this.moveWordToLevel(p.translationId, prevLevel);
        p.recentHistory = [];
      }
    }
  }
  
  /**
   * Gets the next level for progression
   */
  private getNextLevel = (currentLevel: LevelStatus): LevelStatus | null => {
    const levelMap: Record<LevelStatus, LevelStatus> = {
      'LEVEL_0': 'LEVEL_1',
      'LEVEL_1': 'LEVEL_2',
      'LEVEL_2': 'LEVEL_3',
      'LEVEL_3': 'LEVEL_4',
      'LEVEL_4': 'LEVEL_5',
      'LEVEL_5': 'LEVEL_5' // Max level
    };
    return levelMap[currentLevel] === currentLevel ? null : levelMap[currentLevel];
  }
  
  /**
   * Gets the previous level for degradation
   */
  private getPreviousLevel = (currentLevel: LevelStatus): LevelStatus | null => {
    const levelMap: Record<LevelStatus, LevelStatus> = {
      'LEVEL_5': 'LEVEL_4',
      'LEVEL_4': 'LEVEL_3',
      'LEVEL_3': 'LEVEL_2',
      'LEVEL_2': 'LEVEL_1',
      'LEVEL_1': 'LEVEL_0',
      'LEVEL_0': 'LEVEL_0' // Min level
    };
    return levelMap[currentLevel] === currentLevel ? null : levelMap[currentLevel];
  }
  
  /**
   * Moves a word from one level to another
   */
  private moveWordToLevel = (translationId: number, newLevel: LevelStatus): void => {
    const p = this.progress.get(translationId);
    if (!p) return;
    
    // Remove from old queue
    const oldQueue = this.queues[p.status];
    const index = oldQueue.indexOf(translationId);
    if (index > -1) {
      oldQueue.splice(index, 1);
    }
    
    // Update status and add to new queue at the end
    p.status = newLevel;
    this.queues[newLevel].push(translationId);
  }
  
  /**
   * Gets the current state of the quiz manager
   * @returns Current quiz state
   */
  getState = (): QuizState => ({
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
      source: formatForDisplay(translation.sourceWord.text),
      target: formatForDisplay(translation.targetWord.text)
    };
  };

  /**
   * Replenishes the focus pool by promoting words from LEVEL_0 to LEVEL_1
   * @returns Array of translation IDs that were promoted to LEVEL_1
   */
  private replenishFocusPool = (): number[] => {
    // MODIFICATION: Refactored to be more direct and reliable.
    const level1Count = this.queues.LEVEL_1.length;
    let needed = this.opts.maxFocusWords - level1Count;
    if (needed <= 0) return [];
    
    // Directly take from the front of the LEVEL_0 queue.
    const wordsToPromote = this.queues.LEVEL_0.slice(0, needed);
    for (const translationId of wordsToPromote) {
      // This correctly moves the word from the LEVEL_0 queue to the LEVEL_1 queue.
      this.moveWordToLevel(translationId, 'LEVEL_1');
    }
    return wordsToPromote;
  }

  /**
   * Checks if the quiz is complete (all words at target level)
   * @returns True if quiz is complete
   */
  isQuizComplete = (): boolean => {
    const allProgress = Array.from(this.progress.values());
    if (allProgress.length === 0) return false;
    
    if (this.opts.enableUsageExamples) {
      // With usage examples enabled, complete means all at LEVEL_5
      return allProgress.every(p => p.status === 'LEVEL_5');
    } else {
      // Without usage examples, complete means all at LEVEL_3
      return allProgress.every(p => p.status === 'LEVEL_3');
    }
  }
  
  /**
   * Gets quiz completion percentage
   * @returns Completion percentage (0-100)
   */
  getCompletionPercentage = (): number => {
    const allProgress = Array.from(this.progress.values());
    if (allProgress.length === 0) return 0;
    
    const targetLevel = this.opts.enableUsageExamples ? 'LEVEL_5' : 'LEVEL_3';
    const completed = allProgress.filter(p => p.status === targetLevel).length;
    
    return Math.round((completed / allProgress.length) * 100);
  }
  
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
      LEVEL_5: 0
    };
    
    allProgress.forEach(p => {
      levelCounts[p.status]++;
    });
    
    return {
      totalWords: allProgress.length,
      levelCounts,
      completionPercentage: this.getCompletionPercentage(),
      isComplete: this.isQuizComplete()
    };
  }

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
      LEVEL_5: [...this.queues.LEVEL_5]
    };
  };
}

// Export algorithm constants
export { F, K, T_PROMO, MISTAKE_THRESHOLD, MISTAKE_WINDOW, MAX_FOCUS_POOL_SIZE, RECENTLY_ASKED_SIZE, MIN_HISTORY_FOR_DEGRADATION } from './constants';