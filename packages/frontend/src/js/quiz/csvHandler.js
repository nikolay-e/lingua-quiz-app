// csvHandler.js

import {
  quizWords,
  focusWordsSet,
  masteredOneDirectionSet,
  masteredVocabularySet,
  upcomingWordsSet,
} from '../app.js';

export function parseCSV(data) {
  const lines = data.trim().replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  quizWords.clear();
  let currentSet = null;

  [focusWordsSet, masteredOneDirectionSet, masteredVocabularySet, upcomingWordsSet].forEach((set) =>
    set.clear()
  );

  lines.forEach((line) => {
    if (line.includes('Focus Words')) {
      currentSet = focusWordsSet;
    } else if (line.includes('Mastered One Direction')) {
      currentSet = masteredOneDirectionSet;
    } else if (line.includes('Mastered Vocabulary')) {
      currentSet = masteredVocabularySet;
    } else if (line.includes('Upcoming Words')) {
      currentSet = upcomingWordsSet;
    } else if (line) {
      const [word1, word2] = line.split(';');
      if (word1 && word2) {
        quizWords.set(word1, word2);
        if (currentSet) currentSet.add(word1);
      }
    }
  });

  if (quizWords.size() === 0) {
    throw new Error('parseCSV: No valid entries added to quizWords');
  }

  while (focusWordsSet.size < 20 && upcomingWordsSet.size > 0) {
    const wordToMove = upcomingWordsSet.values().next().value;
    focusWordsSet.add(wordToMove);
    upcomingWordsSet.delete(wordToMove);
  }
}

export function generateCSV() {
  const data = [];

  data.push('Focus Words');
  focusWordsSet.forEach((word) => data.push(`${word};${quizWords.get(word)}`));

  data.push('\nMastered One Direction');
  masteredOneDirectionSet.forEach((word) => data.push(`${word};${quizWords.get(word)}`));

  data.push('\nMastered Vocabulary');
  masteredVocabularySet.forEach((word) => data.push(`${word};${quizWords.get(word)}`));

  data.push('\nUpcoming Words');
  upcomingWordsSet.forEach((word) => data.push(`${word};${quizWords.get(word)}`));

  const csvContent = data.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'quiz-data.csv';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
