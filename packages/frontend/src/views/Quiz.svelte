<script>
  import { onMount } from 'svelte';
  import { authStore, quizStore } from '../stores.js';
  import api from '../api.js';
  
  let userAnswer = '';
  let answerInput;
  let feedback = null;
  let usageExamples = null;
  let isSubmitting = false;

  // TTS variables
  let ttsAvailable = false;
  let ttsLanguages = [];
  let isPlayingTTS = false;
  let currentAudio = null;
  
  // Request queuing to prevent concurrent requests
  let requestQueue = Promise.resolve();
  let currentRequestId = 0;
  
  // Foldable lists state
  let foldedLists = {
    level0: false,
    level1: false,
    level2: false,
    level3: false
  };
  
  // Load saved fold states from localStorage
  if (typeof window !== 'undefined') {
    const savedFoldStates = localStorage.getItem('foldedLists');
    if (savedFoldStates) {
      try {
        foldedLists = JSON.parse(savedFoldStates);
      } catch (e) {
        // Use defaults if parsing fails
      }
    }
  }
  
  function toggleFold(level) {
    foldedLists[level] = !foldedLists[level];
    // Save to localStorage
    localStorage.setItem('foldedLists', JSON.stringify(foldedLists));
  }
  
  // Reactive state from stores  
  $: wordSets = $quizStore.wordSets;
  $: selectedQuiz = $quizStore.selectedQuiz;
  $: currentQuestion = $quizStore.currentQuestion;
  $: direction = $quizStore.direction;
  $: sourceLanguage = $quizStore.sourceLanguage;
  $: targetLanguage = $quizStore.targetLanguage;
  $: loading = $quizStore.loading;
  $: wordLists = $quizStore.wordLists;
  $: username = $authStore.username;

  // TTS reactive state
  $: currentLanguage = direction === 'normal' ? sourceLanguage : targetLanguage;
  $: canUseTTS = ttsAvailable && currentQuestion && ttsLanguages.includes(currentLanguage);
  
  // Reactive word lists for display
  $: level0Words = wordLists.level0.map(w => `${w.source} (${w.target})`);
  $: level1Words = wordLists.level1.map(w => `${w.source} (${w.target})`);
  $: level2Words = wordLists.level2.map(w => `${w.source} (${w.target})`);
  $: level3Words = wordLists.level3.map(w => `${w.source} (${w.target})`);
  
  // Direction text
  $: directionText = direction === 'normal' 
    ? `${sourceLanguage} ➔ ${targetLanguage}`
    : `${targetLanguage} ➔ ${sourceLanguage}`;
    
  // TTS functions
  async function loadTTSLanguages() {
    try {
      const ttsData = await api.getTTSLanguages($authStore.token);
      ttsAvailable = ttsData.available;
      ttsLanguages = ttsData.supportedLanguages || [];
    } catch (error) {
      console.warn('Failed to load TTS languages:', error);
      ttsAvailable = false;
      ttsLanguages = [];
    }
  }

  async function playTTS(text, language) {
    if (!canUseTTS || isPlayingTTS) return;
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = null;
    }
    
    isPlayingTTS = true;
    
    try {
      const ttsData = await api.synthesizeSpeech($authStore.token, text, language);
      const audioBlob = new Blob(
        [Uint8Array.from(atob(ttsData.audioData), c => c.charCodeAt(0))],
        { type: ttsData.contentType }
      );
      const audioUrl = URL.createObjectURL(audioBlob);
      
      currentAudio = new Audio(audioUrl);
      currentAudio.onended = () => {
        isPlayingTTS = false;
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };
      currentAudio.onerror = () => {
        isPlayingTTS = false;
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };
      
      await currentAudio.play();
    } catch (error) {
      console.error('TTS playback failed:', error);
      isPlayingTTS = false;
    }
  }

  onMount(async () => {
    await quizStore.loadWordSets($authStore.token);
    await loadTTSLanguages();
    if (answerInput) answerInput.focus();
  });
  
  async function handleQuizSelect(e) {
    const quiz = e.target.value;
    
    // Reset state
    quizStore.reset();
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    
    if (!quiz) return;
    
    try {
      await quizStore.startQuiz($authStore.token, quiz);
      const question = await quizStore.getNextQuestion($authStore.token);
      if (!question) {
        feedback = { message: 'No questions available for this quiz.', isSuccess: false };
      }
      if (answerInput) answerInput.focus();
    } catch (error) {
      console.error('Failed to start quiz:', error);
      feedback = { message: 'Failed to start quiz. Please try again.', isSuccess: false };
    }
  }
  
  async function submitAnswer() {
    if (!currentQuestion || isSubmitting) return;
    
    // Keep focus on input
    if (answerInput) answerInput.focus();
    
    const requestId = ++currentRequestId;
    
    // Queue this request
    requestQueue = requestQueue.then(async () => {
      // Check if this request is still valid
      if (requestId !== currentRequestId) {
        console.log('Request cancelled - newer request exists');
        return;
      }
      
      isSubmitting = true;
      feedback = null; // Clear any previous feedback immediately
      usageExamples = null;
      
      try {
        const result = await quizStore.submitAnswer($authStore.token, userAnswer);
        
        // Only update UI if this is still the current request
        if (requestId === currentRequestId) {
          if (result) {
            feedback = result.feedback;
            usageExamples = result.usageExamples;
            userAnswer = '';
            // Immediately focus the input after clearing
            if (answerInput) answerInput.focus();
          }
        }
      } catch (error) {
        if (requestId === currentRequestId) {
          console.error('Error submitting answer:', error);
          feedback = { message: error.message || 'Error submitting answer. Please try again.', isSuccess: false };
        }
      } finally {
        if (requestId === currentRequestId) {
          isSubmitting = false;
          if (answerInput) answerInput.focus();
        }
      }
    });
    
    await requestQueue;
  }
  
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  }
  
  async function toggleDirection() {
    try {
      await quizStore.toggleDirection($authStore.token);
      const question = await quizStore.getNextQuestion($authStore.token);
      if (!question) {
        feedback = { message: 'No questions available in this direction.', isSuccess: false };
      }
      feedback = null;
      usageExamples = null;
      userAnswer = '';
      if (answerInput) answerInput.focus();
    } catch (error) {
      console.error('Failed to toggle direction:', error);
      feedback = { message: 'Failed to toggle direction. Please try again.', isSuccess: false };
    }
  }
  
  function logout() {
    authStore.logout();
  }
  
</script>

<main class="quiz-container">
  <div class="main-content">
    <section class="quiz-section">
      <h2>
        <div class="quiz-header">
          <div class="quiz-select-container">
            <label for="quiz-select" class="quiz-select-label">
              <i class="fas fa-book"></i> Choose your word list:
            </label>
            <select 
              id="quiz-select" 
              class="quiz-select"
              on:change={handleQuizSelect}
              disabled={loading}
              value={selectedQuiz || ''}
            >
              <option value="">
                {loading ? 'Loading quizzes...' : '🎯 Select a quiz to start learning'}
              </option>
              {#each wordSets as set}
                <option value={set.name}>{set.name}</option>
              {/each}
            </select>
          </div>
        </div>
      </h2>
      
      <div class="quiz-content">
        {#if !selectedQuiz}
          <div class="welcome-message">
            <div class="welcome-icon">🎯</div>
            <h3>Welcome to LinguaQuiz!</h3>
            <p>Choose a word list from the dropdown above to start learning.</p>
            <div class="feature-list">
              <div class="feature">✨ Adaptive learning algorithm</div>
              <div class="feature">📊 Track your progress</div>
              <div class="feature">🔄 Practice in both directions</div>
            </div>
          </div>
        {:else}
          <div class="question">
            <span id="word">
              {currentQuestion ? currentQuestion.word : 'No more questions available.'}
            </span>
            {#if canUseTTS && currentQuestion}
              <button 
                class="tts-button {isPlayingTTS ? 'speaking' : ''}"
                on:click={() => playTTS(currentQuestion.word, currentLanguage)}
                disabled={isPlayingTTS}
                title="Listen to pronunciation"
                aria-label="Listen to pronunciation"
              >
                <i class="fas fa-volume-up"></i>
              </button>
            {/if}
          </div>
        {/if}
        
        {#if currentQuestion}
          <div class="input-group">
            <input 
              type="text" 
              id="answer"
              bind:this={answerInput}
              bind:value={userAnswer}
              on:keydown={handleKeydown}
              placeholder="Your translation"
            />
            <button 
              id="submit" 
              on:mousedown|preventDefault={submitAnswer}
              disabled={isSubmitting}
              tabindex="-1"
            >
              <i class="fas fa-check"></i> Submit
            </button>
          </div>
        {/if}
      </div>
      
      {#if feedback}
        <div class="feedback-container">
          <div class="feedback-text {feedback.isSuccess ? 'success' : 'error'}">
            <span class="feedback-icon"></span>
            <span class="feedback-message">{feedback.message}</span>
          </div>
          {#if usageExamples}
            <div class="usage-examples">
              <div class="example-container">
                <p>{usageExamples.source}</p>
                <p>{usageExamples.target}</p>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </section>
  </div>

  <div class="right-sidebar">
    <div id="user-status">
      <button id="login-logout-btn" on:click={logout}>
        <i class="fas fa-sign-out-alt"></i> 
        <span>Logout ({username})</span>
      </button>
    </div>
    
    {#if selectedQuiz}
      <button 
        class="direction-toggle-btn" 
        id="direction-toggle"
        on:click={toggleDirection}
      >
        <i class="fas fa-exchange-alt"></i> {directionText}
      </button>
    {/if}
    
    <section class="sidebar-section learning-progress">
      <h2>Learning Progress</h2>
      
      <div id="level-1" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level1')}>
          <i class="fas fa-{foldedLists.level1 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-tasks"></i> Learning ({level1Words.length})
        </h3>
        {#if !foldedLists.level1}
          <ol id="level-1-list" class="foldable-content">
            {#each level1Words as word}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-2" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level2')}>
          <i class="fas fa-{foldedLists.level2 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-check-circle"></i> Translation Mastered One Way ({level2Words.length})
        </h3>
        {#if !foldedLists.level2}
          <ol id="level-2-list" class="foldable-content">
            {#each level2Words as word}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-3" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level3')}>
          <i class="fas fa-{foldedLists.level3 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-check-circle"></i> Translation Mastered Both Ways ({level3Words.length})
        </h3>
        {#if !foldedLists.level3}
          <ol id="level-3-list" class="foldable-content">
            {#each level3Words as word}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-0" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level0')}>
          <i class="fas fa-{foldedLists.level0 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-list"></i> New ({level0Words.length})
        </h3>
        {#if !foldedLists.level0}
          <ol id="level-0-list" class="foldable-content">
            {#each level0Words as word}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
    </section>
  </div>
</main>