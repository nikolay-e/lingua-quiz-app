<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { authStore, quizStore } from '../stores';
  import api from '../api';
  import type { SubmissionResult, QuizQuestion } from '@lingua-quiz/core';
  import { formatForDisplay } from '@lingua-quiz/core';
  import type { QuizFeedback } from '@lingua-quiz/core';

  // 1. REFACTOR: Data-driven level configuration (Single Source of Truth)
  const LEVEL_CONFIG = [
    {
      id: 'level0',
      key: 'LEVEL_0',
      label: 'New',
      icon: 'fas fa-list',
      description: (sourceLanguage: string, targetLanguage: string) => `New Words Practice (${sourceLanguage} ➔ ${targetLanguage})`
    },
    {
      id: 'level1',
      key: 'LEVEL_1',
      label: 'Learning',
      icon: 'fas fa-tasks',
      description: (sourceLanguage: string, targetLanguage: string) => `New Words Practice (${sourceLanguage} ➔ ${targetLanguage})`
    },
    {
      id: 'level2',
      key: 'LEVEL_2',
      label: 'Translation Mastered One Way',
      icon: 'fas fa-check-circle',
      description: (sourceLanguage: string, targetLanguage: string) => `Reverse Practice (${targetLanguage} ➔ ${sourceLanguage})`
    },
    {
      id: 'level3',
      key: 'LEVEL_3',
      label: 'Translation Mastered Both Ways',
      icon: 'fas fa-check-circle',
      description: (sourceLanguage: string, targetLanguage: string) => `Context Practice (${sourceLanguage} ➔ ${targetLanguage})`
    },
    {
      id: 'level4',
      key: 'LEVEL_4',
      label: 'Examples Mastered One Way',
      icon: 'fas fa-star',
      description: (sourceLanguage: string, targetLanguage: string) => `Reverse Context (${targetLanguage} ➔ ${sourceLanguage})`
    },
    {
      id: 'level5',
      key: 'LEVEL_5',
      label: 'Fully Mastered',
      icon: 'fas fa-trophy',
      description: () => ''
    }
  ];

  // Component-specific state
  let userAnswer: string = '';
  let answerInput: HTMLInputElement;
  let feedback: SubmissionResult | QuizFeedback | null = null;
  let usageExamples: { source: string; target: string } | null = null;
  let isSubmitting: boolean = false;
  let questionForFeedback: QuizQuestion | null = null;

  // TTS variables
  let ttsAvailable: boolean = false;
  let ttsLanguages: string[] = [];
  let isPlayingTTS: boolean = false;
  let currentAudio: HTMLAudioElement | null = null;

  // 2. REFACTOR: Initialize foldedLists from LEVEL_CONFIG instead of hardcoding
  let foldedLists: Record<string, boolean> = {};

  // Initialize foldedLists dynamically
  LEVEL_CONFIG.forEach(level => {
    foldedLists[level.id] = false;
  });

  // Load saved fold states from localStorage
  if (typeof window !== 'undefined') {
    const savedFoldStates = localStorage.getItem('foldedLists');
    if (savedFoldStates) {
      try {
        const saved = JSON.parse(savedFoldStates);
        // Only update existing keys to prevent issues with config changes
        Object.keys(foldedLists).forEach(key => {
          if (key in saved) {
            foldedLists[key] = saved[key];
          }
        });
      } catch {
        // Use defaults if parsing fails
      }
    }
  }

  // 3. REFACTOR: Single dynamic toggle function (eliminates repetition)
  function toggleFold(levelId: string) {
    foldedLists[levelId] = !foldedLists[levelId];
    localStorage.setItem('foldedLists', JSON.stringify(foldedLists));
  }

  // Reactive state from stores
  $: wordSets = $quizStore.wordSets;
  $: selectedQuiz = $quizStore.selectedQuiz;
  $: currentQuestion = $quizStore.currentQuestion;
  $: loading = $quizStore.loading;
  $: username = $authStore.username;

  // Derived reactive state from currentQuestion and quizManager
  $: direction = currentQuestion?.direction || 'normal';
  $: sourceLanguage = currentQuestion?.sourceLanguage || '';
  $: targetLanguage = currentQuestion?.targetLanguage || '';

  // Get current level from quiz manager for display purposes only
  $: currentLevel = $quizStore.quizManager?.getState().currentLevel || 'LEVEL_1';

  // 4. REFACTOR: Generate word lists dynamically using LEVEL_CONFIG
  $: levelWordLists = $quizStore.quizManager ? (() => {
    const state = $quizStore.quizManager.getState();
    const manager = $quizStore.quizManager;

    return LEVEL_CONFIG.reduce((acc, level) => {
      const words = state.queues[level.key as keyof typeof state.queues]
        ?.map(id => manager.getTranslationForDisplay(id))
        .filter(Boolean)
        .map((w: any) => `${w.source} -> ${w.target}`) || [];

      acc[level.id] = {
        ...level,
        words,
        count: state.queues[level.key as keyof typeof state.queues]?.length || 0
      };
      return acc;
    }, {} as Record<string, any>);
  })() : LEVEL_CONFIG.reduce((acc, level) => {
    acc[level.id] = { ...level, words: [], count: 0 };
    return acc;
  }, {} as Record<string, any>);

  // TTS reactive state
  $: currentLanguage = direction === 'normal' ? sourceLanguage : targetLanguage;
  $: canUseTTS = ttsAvailable && currentQuestion && ttsLanguages.includes(currentLanguage);

  // Reactive focus management - focus input when it becomes available
  $: if (answerInput && currentQuestion) {
    answerInput.focus();
  }

  // 5. REFACTOR: Simplified level description function using LEVEL_CONFIG
  function getLevelDescription(level: string): string {
    const levelConfig = LEVEL_CONFIG.find(config => config.key === level);
    return levelConfig?.description(sourceLanguage, targetLanguage) || '';
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
      currentAudio = null;
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
        currentAudio = null;
      };
      currentAudio.onerror = (): void => {
        isPlayingTTS = false;
        URL.revokeObjectURL(audioUrl);
        currentAudio = null;
      };

      await currentAudio.play();
    } catch (error: unknown) {
      console.error('TTS playback failed:', error);
      isPlayingTTS = false;
    }
  }

  async function handleQuizSelect(e: Event): Promise<void> {
    const target = e.target as HTMLSelectElement;
    const quiz: string = target.value;

    // Reset state
    quizStore.reset();
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    questionForFeedback = null;

    if (!quiz) return;

    try {
      await quizStore.startQuiz($authStore.token!, quiz);
      const question: QuizQuestion | null = await quizStore.getNextQuestion();
      if (!question) {
        feedback = { message: 'No questions available for this quiz.', isSuccess: false } as QuizFeedback;
      }
      // Use tick to ensure DOM updates before focusing
      await tick();
      if (answerInput) answerInput.focus();
    } catch (error: unknown) {
      console.error('Failed to start quiz:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start quiz. Please try again.';
      feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
    }
  }

  async function submitAnswer(): Promise<void> {
    if (!currentQuestion || isSubmitting) return;

    isSubmitting = true;
    questionForFeedback = currentQuestion;

    try {
      const result = await quizStore.submitAnswer($authStore.token!, userAnswer);

      if (result) {
        feedback = result;
        if ('translation' in result && result.translation) {
          usageExamples = {
            source: result.translation.sourceWord.usageExample || '',
            target: result.translation.targetWord.usageExample || ''
          };
          if (!usageExamples.source && !usageExamples.target) {
            usageExamples = null;
          }
        } else {
          usageExamples = null;
        }
        userAnswer = '';
        await advanceToNextQuestion();
      }
    } catch (error: any) {
      console.error('Error submitting answer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error submitting answer.';
      feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
    } finally {
      isSubmitting = false;
    }
  }

  async function advanceToNextQuestion(): Promise<void> {
    quizStore.getNextQuestion();
    await tick();
    if (answerInput) answerInput.focus();
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitAnswer();
    }
  }

  async function logout(): Promise<void> {
    await quizStore.saveAndCleanup($authStore.token!);
    authStore.logout();
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!confirm('Are you absolutely sure you want to delete your account? This action is irreversible and all your progress will be lost.')) {
      return;
    }

    const confirmationText = `delete my account ${$authStore.username}`;
    const userInput = prompt(`This will permanently delete your account. This cannot be undone. To confirm, please type exactly: "${confirmationText}"`);

    if (userInput !== confirmationText) {
      alert('Account deletion cancelled. The entered text did not match.');
      return;
    }

    try {
      await api.deleteAccount($authStore.token!);
      alert('Your account has been successfully deleted.');
      authStore.logout();
    } catch (error: any) {
      console.error('Failed to delete account:', error);
      alert(`Failed to delete account: ${error.message}`);
    }
  }

  // Initialize component
  onMount(() => {
    const initialize = async () => {
      await quizStore.loadWordSets($authStore.token!);
      if ($authStore.token) {
        await loadTTSLanguages();
      }
      await tick();
      if (answerInput) answerInput.focus();
    };

    initialize();

    const handleBeforeUnload = (_e: BeforeUnloadEvent) => {
      if ($quizStore.quizManager && $authStore.token) {
        quizStore.saveAndCleanup($authStore.token).catch(() => {});
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
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
              value={selectedQuiz || ''}
            >
              <option value="">
                {loading ? 'Loading quizzes...' : '🎯 Select a quiz to start learning'}
              </option>
              {#each wordSets as set (set.name)}
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
            <span class="feedback-message">
              {'message' in feedback ? feedback.message :
                feedback.isCorrect ?
                  `${questionForFeedback ? questionForFeedback.questionText : ''} = ${formatForDisplay(feedback.correctAnswerText)}` :
                  `${questionForFeedback ? questionForFeedback.questionText : ''} = ${formatForDisplay(feedback.correctAnswerText)}`}
            </span>
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
      <button id="delete-account-btn" class="delete-button" on:click={handleDeleteAccount}>
        <i class="fas fa-trash-alt"></i>
        <span>Delete Account</span>
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

      <!-- 6. REFACTOR: Generate foldable sections dynamically from LEVEL_CONFIG -->
      {#each Object.values(levelWordLists) as levelData (levelData.id)}
        <div id="{levelData.id}" class="foldable-section">
          <button
            class="foldable-header"
            on:click={() => toggleFold(levelData.id)}
            aria-expanded={!foldedLists[levelData.id]}
          >
            <i class="fas fa-{foldedLists[levelData.id] ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
            <i class="{levelData.icon}"></i> {levelData.label} ({levelData.count})
          </button>
          {#if !foldedLists[levelData.id]}
            <ol id="{levelData.id}-list" class="foldable-content">
              {#each levelData.words as word (word)}
                <li class="word-item">{word}</li>
              {/each}
            </ol>
          {/if}
        </div>
      {/each}
    </section>
  </div>
</main>

<style>
  .delete-button {
    background-color: var(--error-color);
  }

  .delete-button:hover {
    background-color: #c0392b;
  }

  #user-status {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }

  #user-status button {
    width: 100%;
    margin-bottom: 0;
  }
</style>
