<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { authStore, quizStore } from '../stores';
  import api from '../api';
  import type { SubmissionResult } from '@linguaquiz/core';
  import { formatForDisplay } from '@linguaquiz/core';
  import type { QuizFeedback, Translation } from '../types';
  
  
  // Component-specific state
  
  // Basic component state
  let userAnswer = '';
  let answerInput: HTMLInputElement | undefined;
  let feedback: SubmissionResult | QuizFeedback | null = null;
  let usageExamples: { source: string; target: string } | null = null;
  let isSubmitting = false;

  // TTS variables
  let ttsAvailable = false;
  let ttsLanguages: string[] = [];
  let isPlayingTTS = false;
  let currentAudio: HTMLAudioElement | undefined = undefined;
  
  // Request queuing to prevent concurrent requests
  let requestQueue: Promise<void> = Promise.resolve();
  let currentRequestId = 0;
  
  // Foldable lists state
  let foldedLists: Record<string, boolean> = {
    level0: false,
    level1: false,
    level2: false,
    level3: false,
    level4: false,
    level5: false
  };
  
  // Load saved fold states from localStorage
  if (typeof window !== 'undefined') {
    const savedFoldStates = localStorage.getItem('foldedLists');
    if (savedFoldStates) {
      try {
        foldedLists = JSON.parse(savedFoldStates);
      } catch (_e) {
        // Use defaults if parsing fails
      }
    }
  }
  
  function toggleFold(level: string): void {
    foldedLists[level] = !foldedLists[level];
    // Save to localStorage
    localStorage.setItem('foldedLists', JSON.stringify(foldedLists));
  }
  
  // Reactive state from stores
  $: wordSets = $quizStore.wordSets;
  $: selectedQuiz = $quizStore.selectedQuiz;
  $: currentQuestion = $quizStore.currentQuestion;
  $: loading = $quizStore.loading;
  $: username = $authStore.username;
  
  // Derived reactive state from currentQuestion and quizManager
  $: direction = currentQuestion?.direction ?? 'normal';
  $: sourceLanguage = currentQuestion?.sourceLanguage ?? '';
  $: targetLanguage = currentQuestion?.targetLanguage ?? '';
  
  // Get current level from quiz manager for display purposes only
  $: currentLevel = $quizStore.quizManager?.getState().currentLevel ?? 'LEVEL_1';
  
  // Get languages from quiz configuration for level descriptions
  $: quizLanguages = (() => {
    if (!selectedQuiz || !wordSets) return { source: '', target: '' };
    const quiz = wordSets.find(ws => ws.name === selectedQuiz);
    if (!quiz) return { source: '', target: '' };
    // Extract languages from quiz name (e.g., "German Russian A1" -> German, Russian)
    const parts = quiz.name.split(' ');
    if (parts.length >= 2) {
      return { source: parts[0], target: parts[1] };
    }
    return { source: '', target: '' };
  })();
  
  // Get word lists from quiz manager state with proper typing
  $: wordLists = (() => {
    if (!$quizStore.quizManager) {
      return {
        level0: [] as Array<{ source: string; target: string }>,
        level1: [] as Array<{ source: string; target: string }>, 
        level2: [] as Array<{ source: string; target: string }>,
        level3: [] as Array<{ source: string; target: string }>,
        level4: [] as Array<{ source: string; target: string }>,
        level5: [] as Array<{ source: string; target: string }>
      };
    }
    
    const state = $quizStore.quizManager.getState();
    const manager = $quizStore.quizManager;
    
    const filterValidTranslations = (translations: Array<{ source: string; target: string } | undefined>): Array<{ source: string; target: string }> => {
      return translations.filter((t): t is { source: string; target: string } => t !== undefined);
    };
    
    return {
      level0: filterValidTranslations(state.queues.LEVEL_0.map((id: number) => manager.getTranslationForDisplay(id))),
      level1: filterValidTranslations(state.queues.LEVEL_1.map((id: number) => manager.getTranslationForDisplay(id))),
      level2: filterValidTranslations(state.queues.LEVEL_2.map((id: number) => manager.getTranslationForDisplay(id))),
      level3: filterValidTranslations(state.queues.LEVEL_3.map((id: number) => manager.getTranslationForDisplay(id))),
      level4: filterValidTranslations(state.queues.LEVEL_4.map((id: number) => manager.getTranslationForDisplay(id))),
      level5: filterValidTranslations(state.queues.LEVEL_5.map((id: number) => manager.getTranslationForDisplay(id)))
    };
  })();

  // TTS reactive state
  $: currentLanguage = direction === 'normal' ? sourceLanguage : targetLanguage;
  $: canUseTTS = ttsAvailable && currentQuestion && ttsLanguages.includes(currentLanguage);
  
  // Reactive word lists for display with proper typing
  $: level0Words = wordLists.level0.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  $: level1Words = wordLists.level1.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  $: level2Words = wordLists.level2.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  $: level3Words = wordLists.level3.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  $: level4Words = wordLists.level4.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  $: level5Words = wordLists.level5.map((w: { source: string; target: string }) => `${w.source} -> ${w.target}`);
  
  // Current level is now automatically managed by the quiz system
  
  function getLevelDescription(level: string): string {
    const source = quizLanguages.source || sourceLanguage;
    const target = quizLanguages.target || targetLanguage;
    switch (level) {
      case 'LEVEL_1': return `New Words Practice (${source} ➔ ${target})`;
      case 'LEVEL_2': return `Reverse Practice (${target} ➔ ${source})`;
      case 'LEVEL_3': return `Context Practice (${source} ➔ ${target})`;
      case 'LEVEL_4': return `Reverse Context (${target} ➔ ${source})`;
      default: return '';
    }
  }
    
  // TTS functions
  async function loadTTSLanguages(): Promise<void> {
    try {
      const ttsData = await api.getTTSLanguages($authStore.token!);
      ttsAvailable = ttsData.available;
      ttsLanguages = ttsData.supportedLanguages || [];
    } catch (error: unknown) {
      console.warn('Failed to load TTS languages:', error);
      ttsAvailable = false;
      ttsLanguages = [];
    }
  }

  async function playTTS(text: string, language: string): Promise<void> {
    if (!canUseTTS || isPlayingTTS) return;
    
    if (currentAudio) {
      currentAudio.pause();
      currentAudio = undefined;
    }
    
    isPlayingTTS = true;
    
    try {
      const ttsData = await api.synthesizeSpeech($authStore.token!, text, language);
      const audioBlob: Blob = new Blob(
        [Uint8Array.from(atob(ttsData.audioData), (c: string) => c.charCodeAt(0))],
        { type: 'audio/mpeg' }
      );
      const audioUrl: string = URL.createObjectURL(audioBlob);
      
      currentAudio = new Audio(audioUrl);
      currentAudio.onended = (): void => {
        isPlayingTTS = false;
        URL.revokeObjectURL(audioUrl);
        currentAudio = undefined;
      };
      currentAudio.onerror = (): void => {
        isPlayingTTS = false;
        URL.revokeObjectURL(audioUrl);
        currentAudio = undefined;
      };
      
      await currentAudio.play();
    } catch (error: unknown) {
      console.error('TTS playback failed:', error);
      isPlayingTTS = false;
    }
  }

  onMount(async (): Promise<void> => {
    await quizStore.loadWordSets($authStore.token!);
    await loadTTSLanguages();
    if (answerInput) answerInput.focus();
  });
  
  async function handleQuizSelect(e: Event): Promise<void> {
    const target = e.target as HTMLSelectElement;
    const quiz: string = target.value;
    
    // Reset state
    quizStore.reset();
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    
    if (!quiz) return;
    
    try {
      await quizStore.startQuiz($authStore.token!, quiz);
      const question = await quizStore.getNextQuestion();
      if (!question) {
        feedback = { message: 'No questions available for this quiz.', isSuccess: false } as QuizFeedback;
      }
      if (answerInput) answerInput.focus();
    } catch (error: unknown) {
      console.error('Failed to start quiz:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start quiz. Please try again.';
      feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
    }
  }
  
  async function submitAnswer(): Promise<void> {
    if (!currentQuestion || isSubmitting) return;
    
    // Keep focus on input
    if (answerInput) answerInput.focus();
    
    const requestId: number = ++currentRequestId;
    
    // Queue this request
    requestQueue = requestQueue.then(async (): Promise<void> => {
      // Check if this request is still valid
      if (requestId !== currentRequestId) {
        // Request cancelled - newer request exists
        return;
      }
      
      isSubmitting = true;
      feedback = null; // Clear any previous feedback immediately
      usageExamples = null;
      
      try {
        const result = await quizStore.submitAnswer($authStore.token!, userAnswer);
        
        // Only update UI if this is still the current request
        if (requestId === currentRequestId) {
          if (result) {
            feedback = result as SubmissionResult | QuizFeedback;
            // Set usage examples if they exist in the translation
            if (result && typeof result === 'object' && 'translation' in result && result.translation && 
                typeof result.translation === 'object' && 'sourceWord' in result.translation && 'targetWord' in result.translation) {
              const translation = result.translation as Translation;
              usageExamples = {
                source: translation.sourceWord.usageExample ?? '',
                target: translation.targetWord.usageExample ?? ''
              };
              // Only show if at least one example exists
              if (!usageExamples.source && !usageExamples.target) {
                usageExamples = null;
              }
            } else {
              usageExamples = null;
            }
            userAnswer = '';
            // Immediately focus the input after clearing
            if (answerInput) answerInput.focus();
          }
        }
      } catch (error: unknown) {
        if (requestId === currentRequestId) {
          console.error('Error submitting answer:', error);
          const errorMessage = error instanceof Error ? error.message : 'Error submitting answer. Please try again.';
          feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
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
  
  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      void submitAnswer();
    }
  }
  
  // Direction is now handled automatically by level progression
  
  async function logout(): Promise<void> {
    // Save progress before logout
    await quizStore.saveAndCleanup($authStore.token!);
    authStore.logout();
  }
  
  // Store cleanup function reference
  let handleBeforeUnload: (e: BeforeUnloadEvent) => void;
  
  // Initialize component
  onMount(async () => {
    if ($authStore.token) {
      await loadTTSLanguages();
    }
    
    // Save progress before page unload
    handleBeforeUnload = (_e: BeforeUnloadEvent): void => {
      if ($quizStore.quizManager && $authStore.token) {
        // Try to save synchronously (modern browsers may not wait for async)
        void quizStore.saveAndCleanup($authStore.token).catch(() => {});
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
  });
  
  // Cleanup on component destroy
  onDestroy(() => {
    if (handleBeforeUnload) {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    }
  });
  
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
              value={selectedQuiz ?? ''}
            >
              <option value="">
                {loading ? 'Loading quizzes...' : '🎯 Select a quiz to start learning'}
              </option>
              {#each wordSets as set (set.id)}
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
              {currentQuestion ? currentQuestion.questionText : 'No more questions available.'}
            </span>
            {#if canUseTTS && currentQuestion}
              <button 
                class="tts-button {isPlayingTTS ? 'speaking' : ''}"
                on:click={() => playTTS(currentQuestion.questionText, currentLanguage)}
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
              on:mousedown|preventDefault={() => submitAnswer()}
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
          <div class="feedback-text {('isSuccess' in feedback ? feedback.isSuccess : feedback.isCorrect) ? 'success' : 'error'}">
            <span class="feedback-icon"></span>
            <span class="feedback-message">{'message' in feedback ? feedback.message : `${formatForDisplay(feedback.translation.sourceWord.text)} ↔ ${formatForDisplay(feedback.translation.targetWord.text)}`}</span>
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
      <div class="current-level-display">
        <span class="level-label">Current Practice Level:</span>
        <span class="level-description">{getLevelDescription(currentLevel)}</span>
      </div>
    {/if}
    
    <section class="sidebar-section learning-progress">
      <h2>Learning Progress</h2>
      
      <div id="level-1" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level1')}>
          <i class="fas fa-{foldedLists.level1 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-tasks"></i> Learning ({$quizStore.quizManager?.getState().queues.LEVEL_1.length || 0})
        </h3>
        {#if !foldedLists.level1}
          <ol id="level-1-list" class="foldable-content">
            {#each level1Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-2" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level2')}>
          <i class="fas fa-{foldedLists.level2 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-check-circle"></i> Translation Mastered One Way ({$quizStore.quizManager?.getState().queues.LEVEL_2.length || 0})
        </h3>
        {#if !foldedLists.level2}
          <ol id="level-2-list" class="foldable-content">
            {#each level2Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-3" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level3')}>
          <i class="fas fa-{foldedLists.level3 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-check-circle"></i> Translation Mastered Both Ways ({$quizStore.quizManager?.getState().queues.LEVEL_3.length || 0})
        </h3>
        {#if !foldedLists.level3}
          <ol id="level-3-list" class="foldable-content">
            {#each level3Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-4" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level4')}>
          <i class="fas fa-{foldedLists.level4 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-star"></i> Examples Mastered One Way ({$quizStore.quizManager?.getState().queues.LEVEL_4.length || 0})
        </h3>
        {#if !foldedLists.level4}
          <ol id="level-4-list" class="foldable-content">
            {#each level4Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-5" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level5')}>
          <i class="fas fa-{foldedLists.level5 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-trophy"></i> Fully Mastered ({$quizStore.quizManager?.getState().queues.LEVEL_5.length || 0})
        </h3>
        {#if !foldedLists.level5}
          <ol id="level-5-list" class="foldable-content">
            {#each level5Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
      
      <div id="level-0" class="foldable-section">
        <h3 class="foldable-header" on:click={() => toggleFold('level0')}>
          <i class="fas fa-{foldedLists.level0 ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="fas fa-list"></i> New ({$quizStore.quizManager?.getState().queues.LEVEL_0.length || 0})
        </h3>
        {#if !foldedLists.level0}
          <ol id="level-0-list" class="foldable-content">
            {#each level0Words as word (word)}
              <li class="word-item">{word}</li>
            {/each}
          </ol>
        {/if}
      </div>
    </section>
  </div>
</main>