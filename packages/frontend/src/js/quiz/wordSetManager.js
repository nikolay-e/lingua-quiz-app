import { getIncorrectPerWord } from '../utils/statsManager.js';

const lastAskedWords = [];

export default function getRandomWordFromTopFew(wordSet) {
  const stats = getIncorrectPerWord();
  const sortedWords = Array.from(wordSet).map((word) => [word, stats[word] || 0]);
  sortedWords.sort((a, b) => a[1] - b[1]);
  const topFewWords = sortedWords.slice(0, 10).map((item) => item[0]);
  const availableWords = topFewWords.filter((word) => !lastAskedWords.includes(word));

  let selectedWord;
  if (availableWords.length > 0) {
    selectedWord = availableWords[Math.floor(Math.random() * availableWords.length)];
  } else {
    selectedWord = topFewWords[Math.floor(Math.random() * topFewWords.length)];
  }

  lastAskedWords.push(selectedWord);
  if (lastAskedWords.length > 7) {
    lastAskedWords.shift();
  }
  return selectedWord;
}
