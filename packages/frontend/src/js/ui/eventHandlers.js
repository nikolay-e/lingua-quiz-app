// js/ui/eventHandlers.js

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('spanish-english').addEventListener('click', loadSpanishEnglishWords);
    document.getElementById('spanish-russian').addEventListener('click', loadSpanishRussianWords);
    document.getElementById('german-russian').addEventListener('click', loadGermanRussianWords);
    document.getElementById('treasure-island-english-russian').addEventListener('click', loadTreasureIslandEnglishRussianWords);
    document.getElementById('file-input').addEventListener('change', handleFileUpload);
    document.getElementById('answer').addEventListener('keydown', handleEnterKey);
    document.getElementById('submit').addEventListener('click', submitAnswer);
    document.getElementById('download-quiz').addEventListener('click', generateCSV);
});

async function loadSpanishEnglishWords() {
    try {
        const response = await fetch('data/SpanishEnglish.csv');
        const data = await response.text();
        initializeQuiz(data);
    } catch (error) {
        console.error('Error loading quizWords:', error);
    }
}

async function loadSpanishRussianWords() {
    try {
        const response = await fetch('data/SpanishRussian.csv');
        const data = await response.text();
        initializeQuiz(data);
    } catch (error) {
        console.error('Error loading quizWords:', error);
    }
}

async function loadGermanRussianWords() {
    try {
        const response = await fetch('data/GermanRussian.csv');
        const data = await response.text();
        initializeQuiz(data);
    } catch (error) {
        console.error('Error loading quizWords:', error);
    }
}

async function loadTreasureIslandEnglishRussianWords() {
    try {
        const response = await fetch('data/TreasureIslandEnglishRussian.csv');
        const data = await response.text();
        initializeQuiz(data);
    } catch (error) {
        console.error('Error loading quizWords:', error);
    }
}

async function handleFileUpload() {
    const file = document.getElementById('file-input').files[0];
    if (file) {
        try {
            const data = await file.text();
            initializeQuiz(data);
        } catch (error) {
            console.error('Error reading file:', error);
        }
    }
}

function handleEnterKey(event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        document.getElementById('submit').click();
    }
}

function submitAnswer() {
    const userAnswer = document.getElementById('answer').value;
    const originalWord = document.getElementById('word').textContent;
    const isAnswerCorrect = verifyAnswer(userAnswer);

    const feedbackElement = document.getElementById('feedback');

if (isAnswerCorrect) {
    feedbackElement.textContent = 'Correct!';
    feedbackElement.classList.remove('error');
    feedbackElement.classList.add('success');
} else {
    feedbackElement.textContent = `Wrong. The correct answer for '${originalWord}' was '${quizWords[originalWord]}'.`;
    feedbackElement.classList.remove('success');
    feedbackElement.classList.add('error');
}

    document.getElementById('answer').value = '';
    continueQuiz();
    document.getElementById('answer').focus();
}


document.getElementById('direction-switch').addEventListener('change', function() {
    const label = document.getElementById('direction-label');
    if (this.checked) {
        label.textContent = 'Reverse';
        direction = false;
    } else {
        label.textContent = 'Normal';
        direction = true;
    }
});
