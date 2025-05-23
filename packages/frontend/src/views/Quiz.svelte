<script>
  import { onMount } from 'svelte';
  import { authStore, quizStore } from '../stores.js';
  
  let userAnswer = '';
  let answerInput;
  let feedback = null;
  let usageExamples = null;
  let currentQuestion = null;
  let isSubmitting = false;
  
  // Reactive state from stores
  $: wordSets = $quizStore.wordSets;
  $: selectedQuiz = $quizStore.selectedQuiz;
  $: direction = $quizStore.direction;
  $: sourceLanguage = $quizStore.sourceLanguage;
  $: targetLanguage = $quizStore.targetLanguage;
  $: loading = $quizStore.loading;
  $: email = $authStore.email;
  
  // Reactive word lists - THIS IS THE KEY FIX
  $: level0Words = Array.from($quizStore.wordStatusSets?.LEVEL_0 || new Set())
    .map(id => $quizStore.translations.get(id))
    .filter(Boolean)
    .map(word => `${word.sourceWord} (${word.targetWord})`);
    
  $: level1Words = Array.from($quizStore.wordStatusSets?.LEVEL_1 || new Set())
    .map(id => $quizStore.translations.get(id))
    .filter(Boolean)
    .map(word => `${word.sourceWord} (${word.targetWord})`);
    
  $: level2Words = Array.from($quizStore.wordStatusSets?.LEVEL_2 || new Set())
    .map(id => $quizStore.translations.get(id))
    .filter(Boolean)
    .map(word => `${word.sourceWord} (${word.targetWord})`);
    
  $: level3Words = Array.from($quizStore.wordStatusSets?.LEVEL_3 || new Set())
    .map(id => $quizStore.translations.get(id))
    .filter(Boolean)
    .map(word => `${word.sourceWord} (${word.targetWord})`);
  
  // Derived values
  $: directionText = direction 
    ? `${sourceLanguage} ➔ ${targetLanguage}`
    : `${targetLanguage} ➔ ${sourceLanguage}`;
    
  onMount(async () => {
    await quizStore.loadWordSets($authStore.token);
    if (answerInput) answerInput.focus();
  });
  
  async function handleQuizSelect(e) {
    const quiz = e.target.value;
    
    // Reset state first
    quizStore.reset();
    currentQuestion = null;
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    
    if (!quiz) {
      return;
    }
    
    try {
      console.log('Loading quiz:', quiz);
      await quizStore.loadQuiz($authStore.token, quiz);
      
      // Small delay to ensure state is fully updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      currentQuestion = quizStore.getNextQuestion();
      if (answerInput) answerInput.focus();
    } catch (error) {
      console.error('Failed to load quiz:', error);
      // Handle error appropriately
    }
  }
  
  async function submitAnswer() {
    if (!currentQuestion || isSubmitting) return;
    
    isSubmitting = true;
    
    try {
      const result = await quizStore.submitAnswer(userAnswer);
      
      if (result) {
        feedback = result.feedback;
        usageExamples = result.usageExamples;
        userAnswer = '';
        
        // Add a small delay to ensure state updates properly
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Get next question
        currentQuestion = quizStore.getNextQuestion();
      }
    } catch (error) {
      console.error('Error submitting answer:', error);
      feedback = { message: 'Error submitting answer. Please try again.', isSuccess: false };
    } finally {
      isSubmitting = false;
      if (answerInput) answerInput.focus();
    }
  }
  
  function handleKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  }
  
  function toggleDirection() {
    quizStore.toggleDirection();
    currentQuestion = quizStore.getNextQuestion();
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    if (answerInput) answerInput.focus();
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
          <div class="quiz-select">
            <select 
              id="quiz-select" 
              on:change={handleQuizSelect}
              disabled={loading}
              value={selectedQuiz || ''}
            >
              <option value="">
                {loading ? 'Loading quizzes...' : 'Select a quiz'}
              </option>
              {#each wordSets as set}
                <option value={set.name}>{set.name}</option>
              {/each}
            </select>
          </div>
        </div>
      </h2>
      
      <div class="quiz-content">
        <div class="question">
          <span id="word">
            {currentQuestion ? currentQuestion.word : (selectedQuiz ? 'No more questions available.' : '')}
          </span>
        </div>
        
        {#if currentQuestion}
          <div class="input-group">
            <input 
              type="text" 
              id="answer"
              bind:this={answerInput}
              bind:value={userAnswer}
              on:keydown={handleKeydown}
              placeholder="Your translation"
              disabled={isSubmitting}
            />
            <button 
              id="submit" 
              on:click={submitAnswer}
              disabled={isSubmitting}
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
        <span>Logout ({email})</span>
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
      
      <div id="level-1">
        <h3><i class="fas fa-tasks"></i> Learning ({level1Words.length})</h3>
        <ol id="level-1-list">
          {#each level1Words as word}
            <li>{word}</li>
          {:else}
            <li>No words currently learning</li>
          {/each}
        </ol>
      </div>
      
      <div id="level-2">
        <h3><i class="fas fa-check-circle"></i> Translation Mastered (One Way) ({level2Words.length})</h3>
        <ol id="level-2-list">
          {#each level2Words as word}
            <li>{word}</li>
          {:else}
            <li>No words mastered in one direction yet</li>
          {/each}
        </ol>
      </div>
      
      <div id="level-3">
        <h3><i class="fas fa-check-circle"></i> Translation Mastered (Both Ways) ({level3Words.length})</h3>
        <ol id="level-3-list">
          {#each level3Words as word}
            <li>{word}</li>
          {:else}
            <li>No words fully mastered yet</li>
          {/each}
        </ol>
      </div>
      
      <div id="level-0">
        <h3><i class="fas fa-list"></i> New ({level0Words.length})</h3>
        <ol id="level-0-list">
          {#each level0Words as word}
            <li>{word}</li>
          {:else}
            <li>No new words available</li>
          {/each}
        </ol>
      </div>
    </section>
  </div>
</main>