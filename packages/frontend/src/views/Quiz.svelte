<script lang="ts">
  import { onMount, tick, onDestroy } from 'svelte';
  import { authStore, quizStore, levelWordLists, safeStorage } from '../stores';
  import type { SubmissionResult, QuizQuestion } from '@lingua-quiz/core';
  import type { QuizFeedback } from '../api-types';
  import { LEVEL_CONFIG } from '../lib/config/levelConfig';
  import { ttsService } from '../lib/services/ttsService';
  import { STORAGE_KEYS } from '../lib/constants';

  // Import new components
  import QuizHeader from '../components/quiz/QuizHeader.svelte';
  import QuestionDisplay from '../components/quiz/QuestionDisplay.svelte';
  import FeedbackDisplay from '../components/quiz/FeedbackDisplay.svelte';
  import LearningProgress from '../components/quiz/LearningProgress.svelte';
  import FeedCard from '../components/FeedCard.svelte';
  import LevelChangeAnimation from '../components/quiz/LevelChangeAnimation.svelte';

  // Level configuration imported from @lingua-quiz/core

  // State variables
  let userAnswer: string = '';
  let answerInput: HTMLInputElement;
  let feedback: SubmissionResult | QuizFeedback | null = null;
  let usageExamples: { source: string; target: string } | null = null;
  let isSubmitting: boolean = false;
  let questionForFeedback: QuizQuestion | null = null;

  // Level change animation state
  let showLevelAnimation = false;
  let isLevelUp = true;

  // TTS state (managed by service)
  let ttsState: import('../lib/services/ttsService').TTSState = { isAvailable: false, supportedLanguages: [], isPlaying: false };

  // 2. REFACTOR: Initialize foldedLists from LEVEL_CONFIG instead of hardcoding
  let foldedLists: Record<string, boolean> = {};

  // Initialize foldedLists dynamically
  LEVEL_CONFIG.forEach(level => {
    foldedLists[level.id] = true;
  });

  // Load saved fold states from localStorage
  const savedFoldStates = safeStorage.getItem(STORAGE_KEYS.FOLDED_LISTS);
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

  // 3. REFACTOR: Single dynamic toggle function (eliminates repetition)
  function toggleFold(event: CustomEvent<{ levelId: string }>) {
    const levelId = event.detail.levelId;
    foldedLists[levelId] = !foldedLists[levelId];
    safeStorage.setItem(STORAGE_KEYS.FOLDED_LISTS, JSON.stringify(foldedLists));
  }

  // Reactive state from stores
  $: wordSets = $quizStore.wordSets;
  $: selectedQuiz = $quizStore.selectedQuiz;
  $: currentQuestion = $quizStore.currentQuestion;
  $: loading = $quizStore.loading;
  $: username = $authStore.username;

  // Derived reactive state from currentQuestion and quizManager
  $: direction = currentQuestion?.direction || 'normal';
  $: sourceLanguage = currentQuestion?.sourceLanguage || $quizStore.quizManager?.getState().translations[0]?.sourceWord.language || '';
  $: targetLanguage = currentQuestion?.targetLanguage || $quizStore.quizManager?.getState().translations[0]?.targetWord.language || '';

  // Get current level from quiz manager for display purposes only (memoized)
  let currentLevel: string = 'LEVEL_1';
  let lastCurrentLevel: string = 'LEVEL_1';

  $: {
    const newLevel = $quizStore.quizManager?.getState().currentLevel || 'LEVEL_1';
    if (newLevel !== lastCurrentLevel) {
      lastCurrentLevel = newLevel;
      currentLevel = newLevel;
    }
  }

  // Level word lists are now handled by a derived store for efficiency

  // TTS reactive state
  $: currentLanguage = direction === 'normal' ? sourceLanguage : targetLanguage;
  $: canUseTTS = currentQuestion && ttsService.canUseTTS(currentLanguage);

  // Reactive focus management - focus input when it becomes available
  $: if (answerInput && currentQuestion) {
    answerInput.focus();
  }


  async function handleQuizSelect(event: CustomEvent<{ quiz: string }>): Promise<void> {
    const quiz = event.detail.quiz;

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

  function handleBackToMenu(): void {
    // Save progress in background (non-blocking)
    if ($authStore.token) {
      quizStore.saveAndCleanup($authStore.token).catch((error) => {
        console.error('Failed to save progress before returning to menu:', error);
        // Progress will be saved on next session
      });
    }

    // Reset UI immediately
    quizStore.reset();
    feedback = null;
    usageExamples = null;
    userAnswer = '';
    questionForFeedback = null;
  }

  async function submitAnswer(): Promise<void> {
    if (!currentQuestion || isSubmitting) return;

    isSubmitting = true;
    questionForFeedback = currentQuestion;

    try {
      // Submit answer and get feedback (this is now non-blocking for API calls)
      const result = await quizStore.submitAnswer($authStore.token!, userAnswer);

      if (result) {
        // Update UI immediately
        feedback = result;
        if ('translation' in result && result.translation) {
          usageExamples = {
            source: result.translation.sourceWord.usageExample || '',
            target: result.translation.targetWord.usageExample || ''
          };
        } else {
          usageExamples = null;
        }

        // Check for level change and trigger animation
        if ('levelChange' in result && result.levelChange) {
          const fromLevel = parseInt(result.levelChange.from.replace('LEVEL_', ''));
          const toLevel = parseInt(result.levelChange.to.replace('LEVEL_', ''));
          isLevelUp = toLevel > fromLevel;
          showLevelAnimation = true;
        }

        userAnswer = '';

        // Get next question (local operation, no API call)
        quizStore.getNextQuestion();

        await tick();
        if (answerInput) answerInput.focus();
      }
    } catch (error: unknown) {
      console.error('Error submitting answer:', error);
      const errorMessage = error instanceof Error ? error.message : 'Error submitting answer.';
      feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
    } finally {
      isSubmitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !isSubmitting) {
      submitAnswer();
    }
  }

  async function logout(): Promise<void> {
    await authStore.logout();
  }

  async function handleDeleteAccount(): Promise<void> {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    try {
      await authStore.deleteAccount();
      alert('Your account has been successfully deleted.');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to delete account';
      alert(`Failed to delete account: ${message}`);
    }
  }

  onMount(() => {
    // Subscribe to TTS service state
    const unsubscribeTTS = ttsService.subscribe((state) => {
      ttsState = state;
    });

    // Initialize asynchronously
    (async () => {
      if ($authStore.token) {
        await ttsService.initializeLanguages($authStore.token);
        // Load available word sets
        try {
          await quizStore.loadWordSets($authStore.token);
        } catch (error) {
          console.error('Failed to load word sets:', error);
        }
      }
      await tick();
      if (answerInput) answerInput.focus();
    })();

    // Return cleanup function
    return () => {
      unsubscribeTTS();
    };
  });

  onMount(() => {
    const handleBeforeUnload = async () => {
      if ($authStore.token && $quizStore.quizManager) {
        await quizStore.saveAndCleanup($authStore.token);
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => {
    // Cleanup TTS service resources
    ttsService.destroy();
  });
</script>

{#key selectedQuiz}
<main class="feed">
  <!-- Card: Quiz picker / header -->
  <FeedCard title={selectedQuiz ? undefined : undefined}>
    {#if !selectedQuiz}
      <header class="flex-align-center gap-sm mb-md">
        <h1 class="logo"><i class="fas fa-language"></i> LinguaQuiz</h1>
      </header>
    {/if}
    <div class="stack">
      <QuizHeader
        {wordSets}
        {selectedQuiz}
        {loading}
        on:select={handleQuizSelect}
        on:backToMenu={handleBackToMenu}
      />
      {#if !selectedQuiz}
        <div class="text-center p-xl">
          <div class="welcome-icon mb-md">🎯</div>
          <h3>Welcome to LinguaQuiz!</h3>
          <p class="muted mb-lg">Start learning with these features:</p>
          <div class="stack">
            <a href="https://github.com/nikolay-e/lingua-quiz/blob/main/docs/LearningAlgorithm.md" target="_blank" class="feature feature-link">
              ✨ Adaptive learning algorithm
            </a>
            <div class="feature">📊 Track your progress in real-time</div>
            <div class="feature">🎧 Listen to pronunciations</div>
          </div>
        </div>
      {/if}
    </div>
  </FeedCard>

  <!-- Card: Question -->
  {#if selectedQuiz}
    <FeedCard dense title="Translate">
      <svelte:fragment slot="headerAction">
        {#if canUseTTS}
          <button
            class="tts-button {ttsState.isPlaying ? 'speaking' : ''}"
            on:click={() => currentQuestion && ttsService.playTTS($authStore.token!, currentQuestion.questionText, currentLanguage)}
            disabled={ttsState.isPlaying}
            title="Listen to pronunciation"
            aria-label="Listen to pronunciation"
          >
            <i class="fas fa-volume-up"></i>
            <span>Listen</span>
          </button>
        {/if}
      </svelte:fragment>
      <QuestionDisplay {currentQuestion} />
    </FeedCard>
  {/if}

  <!-- Card: Answer input -->
  {#if currentQuestion}
    <FeedCard dense>
      <div class="actions">
        <input
          type="text"
          bind:this={answerInput}
          bind:value={userAnswer}
          on:keydown={handleKeydown}
          placeholder="Type your answer…"
          disabled={isSubmitting}
          aria-describedby="word"
        />
        <button type="button" on:click={submitAnswer} disabled={isSubmitting}>
          <i class="fas fa-paper-plane"></i> {isSubmitting ? 'Submitting…' : 'Submit'}
        </button>
      </div>
    </FeedCard>
  {/if}

  <!-- Card: Feedback -->
  {#if feedback}
    <FeedCard dense>
      <FeedbackDisplay
        {feedback}
        {usageExamples}
        {questionForFeedback}
      />
    </FeedCard>
  {/if}

  <!-- Card: Progress -->
  {#if selectedQuiz}
    <FeedCard>
      <LearningProgress
        selectedQuiz={selectedQuiz || undefined}
        {currentLevel}
        {sourceLanguage}
        {targetLanguage}
        levelWordLists={$levelWordLists}
        {foldedLists}
        on:toggleFold={toggleFold}
      />
    </FeedCard>
  {/if}

  <!-- Card: Account actions -->
  <FeedCard dense>
    <div class="actions">
      <button class="logout-button" on:click={logout}>
        <i class="fas fa-sign-out-alt"></i> Logout ({username})
      </button>
      <button class="delete-button" on:click={handleDeleteAccount}>
        <i class="fas fa-trash-alt"></i> Delete Account
      </button>
    </div>
  </FeedCard>
</main>
{/key}

<!-- Level change animation overlay -->
<LevelChangeAnimation
  bind:isVisible={showLevelAnimation}
  {isLevelUp}
  on:complete={() => showLevelAnimation = false}
/>

<style>
  /* Trim the old quiz-container/blocky layout—feed + cards do the layout now */
  .delete-button {
    background-color: var(--error-color);
  }

  .delete-button:hover {
    background-color: #c0392b;
  }

  /* Custom styles not covered by utilities */
  .logo {
    margin: 0;
    color: var(--primary-color);
    font-size: var(--font-size-xl);
  }

  /* Feature link styling */
  .feature-link {
    text-decoration: none;
    color: inherit;
    transition: all var(--transition-speed) ease;
    cursor: pointer;
  }

  .feature-link:hover {
    background-color: var(--primary-color);
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgb(74 144 226 / 30%);
  }
</style>
