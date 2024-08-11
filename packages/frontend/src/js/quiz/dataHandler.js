import {
  quizWords,
  focusWordsSet,
  masteredOneDirectionSet,
  masteredVocabularySet,
  upcomingWordsSet,
  sourceLanguage,
  targetLanguage,
  setSourceLanguage,
  setTargetLanguage,
  supportedLanguages,
} from '../app.js';

function detectLanguages(data) {
  const languages = new Set();
  Object.values(data).forEach((words) => {
    words.forEach((word) => {
      Object.keys(word).forEach((lang) => {
        if (supportedLanguages.includes(lang)) {
          languages.add(lang);
        }
      });
    });
  });
  return Array.from(languages);
}

export function parseJSON(jsonData) {
  let data;
  try {
    data = JSON.parse(jsonData);
  } catch (error) {
    console.error('Invalid JSON data:', error);
    throw new Error('Invalid JSON data');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Invalid data structure in JSON');
  }

  quizWords.clear();
  [focusWordsSet, masteredOneDirectionSet, masteredVocabularySet, upcomingWordsSet].forEach((set) =>
    set.clear()
  );

  const detectedLanguages = detectLanguages(data);
  if (detectedLanguages.length < 2) {
    throw new Error('At least two supported languages must be present in the data');
  }

  setSourceLanguage(detectedLanguages[0]);
  setTargetLanguage(detectedLanguages[1]);

  Object.entries(data).forEach(([category, words]) => {
    if (!Array.isArray(words)) {
      console.warn(`Invalid category data for ${category}`);
      return;
    }

    const currentSet = {
      'Focus Words': focusWordsSet,
      'Mastered One Direction': masteredOneDirectionSet,
      'Mastered Vocabulary': masteredVocabularySet,
      'Upcoming Words': upcomingWordsSet,
    }[category];

    words.forEach((word) => {
      if (typeof word === 'object' && word[sourceLanguage] && word[targetLanguage]) {
        quizWords.set(word[sourceLanguage], word[targetLanguage]);
        if (currentSet) currentSet.add(word[sourceLanguage]);
      } else {
        console.warn('Invalid word entry:', word);
      }
    });
  });

  if (quizWords.size() === 0) {
    throw new Error('No valid entries added to quizWords');
  }

  while (focusWordsSet.size < 20 && upcomingWordsSet.size > 0) {
    const wordToMove = upcomingWordsSet.values().next().value;
    focusWordsSet.add(wordToMove);
    upcomingWordsSet.delete(wordToMove);
  }
}

export function generateJSON() {
  const data = {
    'Focus Words': [],
    'Mastered One Direction': [],
    'Mastered Vocabulary': [],
    'Upcoming Words': [],
  };

  [
    [focusWordsSet, 'Focus Words'],
    [masteredOneDirectionSet, 'Mastered One Direction'],
    [masteredVocabularySet, 'Mastered Vocabulary'],
    [upcomingWordsSet, 'Upcoming Words'],
  ].forEach(([set, category]) => {
    set.forEach((word) => {
      data[category].push({
        [sourceLanguage]: word,
        [targetLanguage]: quizWords.get(word),
      });
    });
  });

  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], {
    type: 'application/json;charset=utf-8;',
  });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'quiz-data.json';
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function validateJSONStructure(data) {
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid JSON structure: root should be an object');
  }

  const requiredCategories = [
    'Focus Words',
    'Mastered One Direction',
    'Mastered Vocabulary',
    'Upcoming Words',
  ];
  // eslint-disable-next-line no-restricted-syntax
  for (const category of requiredCategories) {
    if (!Array.isArray(data[category])) {
      throw new Error(`Invalid JSON structure: '${category}' should be an array`);
    }
  }

  const languages = detectLanguages(data);
  if (languages.length < 2) {
    throw new Error('Invalid JSON structure: at least two supported languages are required');
  }

  Object.values(data).forEach((words) => {
    words.forEach((word, index) => {
      if (typeof word !== 'object' || word === null) {
        throw new Error(`Invalid word entry at index ${index}: should be an object`);
      }
      if (!languages.every((lang) => typeof word[lang] === 'string')) {
        throw new Error(
          `Invalid word entry at index ${index}: missing or invalid language entries`
        );
      }
    });
  });
}
