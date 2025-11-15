/**
 * Answer comparison and text processing logic for LinguaQuiz
 *
 * This module handles all text normalization, answer validation, and display formatting
 * according to the rules defined in docs/answer-comparison-logic.md
 */

/* --------------------------------------------------
 * Normalisation helpers
 * -------------------------------------------------- */

// Mapping of visually identical Latin → Cyrillic characters
// Only letters that look EXACTLY the same
const latinToCyrillic: Record<string, string> = {
  a: 'а',
  A: 'А', // a/A look identical to а/А
  c: 'с',
  C: 'С', // c/C look identical to с/С
  e: 'е',
  E: 'Е', // e/E look identical to е/Е
  o: 'о',
  O: 'О', // o/O look identical to о/О
  p: 'р',
  P: 'Р', // p/P look identical to р/Р
  x: 'х',
  X: 'Х', // x/X look identical to х/Х
  y: 'у',
  Y: 'У', // y/Y look identical to у/У
};

/** Remove diacritics from the Latin script (NFD → strip marks). */
const stripLatinDiacritics = (s: string): string => {
  // Only strip diacritics from Latin characters, not from Cyrillic
  return s.replace(/[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ]/g, (char) => {
    return char.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  });
};

/** Collapse German umlaut/ß variants to a single form for comparison. */
const collapseGerman = (s: string): string => {
  return (
    s
      // 1. Single‑character umlauts → plain vowel.
      .replace(/ä/g, 'a')
      .replace(/ö/g, 'o')
      .replace(/ü/g, 'u')
      .replace(/Ä/g, 'a')
      .replace(/Ö/g, 'o')
      .replace(/Ü/g, 'u')
      .replace(/ß/g, 'ss')
      // 2. Two‑character replacements (ae/oe/ue) → same plain vowel.
      .replace(/ae/g, 'a')
      .replace(/oe/g, 'o')
      .replace(/ue/g, 'u')
  );
};

/** Full script‑/accent‑aware canonicalisation used for matching logic. */
export const normalizeForComparison = (text: string): string => {
  if (!text) return '';
  let result = text;

  // 1. Trim + lower + remove all whitespace (spaces are ignored).
  result = result.trim().toLowerCase().replace(/\s+/g, '');

  // 2. Always apply German & Spanish normalization first (safe for all text)
  result = collapseGerman(stripLatinDiacritics(result));

  // 3. Apply Cyrillic conversion only when appropriate
  const containsCyr = /[а-яё]/i.test(result);

  // Convert if there's already Cyrillic present and we have visually identical Latin chars
  if (containsCyr) {
    result = result.replace(/[aAcCeEoOpPxXyY]/g, (ch) => latinToCyrillic[ch] || ch);
  }

  // Conservative lookalike conversion for very specific cases
  // LIMITATION: This heuristic may still incorrectly convert some English words
  // like "cop", "cap", "pay" to Cyrillic. This is a known trade-off.
  // Only convert if the word strongly suggests Russian input error
  const onlyLookalikes = /^[aAcCeEoOpPxXyY]+$/i.test(result);
  if (onlyLookalikes && result.length <= 3) {
    // Very restrictive: only 3 chars or less, and contains patterns common in Russian
    const strongRussianPattern = result.includes('py') || result.includes('op') || result.includes('po');
    if (strongRussianPattern) {
      result = result.replace(/[aAcCeEoOpPxXyY]/g, (ch) => latinToCyrillic[ch] || ch);
    }
  }

  // 5. Always apply ё→е mapping for any Cyrillic characters
  result = result.replace(/ё/g, 'е');

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
    const firstAlt =
      inner
        .split('|')
        .map((s: string) => s.trim())
        .find((s: string) => s) ?? '';
    return firstAlt; // drop surrounding parentheses.
  });

  // Remove any leftover empty parentheses "()" (possibly multiple).
  while (/\(\s*\)/.test(text)) text = text.replace(/\(\s*\)/g, '');

  // 2. Temporarily mask pipes inside square brackets so we don't treat them as
  //    synonym separators.
  text = text.replace(/\[[^\]]*\]/g, (br) => br.replace(/\|/g, PIPE_SENTINEL));

  // 3. For any remaining standalone pipes, keep only the segment before the
  //    first one.
  if (text.includes('|')) {
    text = (text.split('|')[0] ?? '').trim();
  }

  // 4. Unmask bracket pipes and tidy up whitespace / commas.
  text = text
    .replace(new RegExp(PIPE_SENTINEL, 'g'), '|')
    .replace(/\s*,\s*/g, ', ') // single space after comma.
    .replace(/\s+/g, ' ') // collapse runs of spaces.
    .trim()
    .replace(/^,+\s*/, '') // no leading commas (multiple)
    .replace(/\s*,+$/, '') // no trailing commas (multiple)
    .replace(/,+\s*,+/g, ', ') // collapse multiple consecutive commas
    .replace(/^,\s*|,\s*$/g, '') // final cleanup of leading/trailing commas
    .trim();

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
 *  acceptable raw alternatives (still UNnormalized).
 *
 * LIMITATION: Only handles the first occurrence of square brackets in a group.
 * A string like `word[opt1]suffix[opt2]` will not be expanded correctly.
 * This is documented as a known edge case limitation.
 */
const expandGroup = (group: string): string[] => {
  let g = group.trim();

  // 1. Strip outer parentheses *if* they wrap the whole group and contain pipes.
  if (g.startsWith('(') && g.endsWith(')') && g.includes('|')) {
    g = g.slice(1, -1);
  }

  // 2. Handle square brackets for optional parts (first occurrence only)
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

  // 3. Split any pipes inside each base variant to generate all alternatives.
  const alts: string[] = [];
  baseVariants.forEach((b) => {
    if (b.includes('|')) {
      b.split('|').forEach((p) => {
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
  return groups.map((g) => {
    const set: AltSet = new Set(expandGroup(g).map((n: string) => normalize(n)));
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
    const firstGroup = correctGroups[0];
    if (!firstGroup) return false;
    return firstGroup.has(normalize(userAnswer));
  }

  // Multi‑meaning answer – user must supply same number of comma parts in any order.
  const userTokens = splitTopLevelCommas(userAnswer).map((t: string) => normalize(t));
  if (userTokens.length !== correctGroups.length) return false;

  const used = new Set<number>();
  for (const token of userTokens) {
    let matched = false;
    for (let i = 0; i < correctGroups.length; i++) {
      if (used.has(i)) continue;
      const group = correctGroups[i];
      if (!group) continue;
      if (group.has(token)) {
        used.add(i);
        matched = true;
        break;
      }
    }
    if (!matched) return false; // token didn't fit any group.
  }
  return true;
};
