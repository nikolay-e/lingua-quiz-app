<script lang="ts">
  import { onMount, tick, onDestroy } from 'svelte';
  import { authStore, quizStore, levelWordLists, safeStorage } from '../stores';
  import type { SubmissionResult, QuizQuestion } from '@lingua-quiz/core';
  import type { QuizFeedback } from '../api-types';
  import { LEVEL_CONFIG } from '../lib/config/levelConfig';
  import { ttsService } from '../lib/services/ttsService';
  import { STORAGE_KEYS } from '../lib/constants';

  import QuizHeader from '../components/quiz/QuizHeader.svelte';
  import QuestionDisplay from '../components/quiz/QuestionDisplay.svelte';
  import FeedbackDisplay from '../components/quiz/FeedbackDisplay.svelte';
  import LearningProgress from '../components/quiz/LearningProgress.svelte';
  import FeedCard from '../components/FeedCard.svelte';
  import LevelChangeAnimation from '../components/quiz/LevelChangeAnimation.svelte';

  let userAnswer: string = '';
  let answerInput: HTMLInputElement;
  let feedback: SubmissionResult | QuizFeedback | null = null;
  let usageExamples: { source: string; target: string } | null = null;
  let isSubmitting: boolean = false;
  let questionForFeedback: QuizQuestion | null = null;

  let showLevelAnimation = false;
  let isLevelUp = true;

  let ttsState: import('../lib/services/ttsService').TTSState = { isAvailable: false, supportedLanguages: [], isPlaying: false };

  const foldedLists: Record<string, boolean> = {};

  LEVEL_CONFIG.forEach(level => {
    foldedLists[level.id] = true;
  });

  const savedFoldStates = safeStorage.getItem(STORAGE_KEYS.FOLDED_LISTS);
  if (savedFoldStates) {
    try {
      const saved = JSON.parse(savedFoldStates);
      Object.keys(foldedLists).forEach(key => {
        if (key in saved) {
          foldedLists[key] = saved[key];
        }
      });
    } catch {
    // Ignore parsing errors for corrupted localStorage
    }
  }

  function toggleFold(event: CustomEvent<{ levelId: string }>) {
    const {levelId} = event.detail;
    foldedLists[levelId] = !foldedLists[levelId];
    safeStorage.setItem(STORAGE_KEYS.FOLDED_LISTS, JSON.stringify(foldedLists));
  }

  // eslint-disable-next-line prefer-destructuring
  $: wordLists = $quizStore.wordLists;
  // eslint-disable-next-line prefer-destructuring
  $: selectedQuiz = $quizStore.selectedQuiz;
  // eslint-disable-next-line prefer-destructuring
  $: currentQuestion = $quizStore.currentQuestion;
  // eslint-disable-next-line prefer-destructuring
  $: loading = $quizStore.loading;
  // eslint-disable-next-line prefer-destructuring
  $: username = $authStore.username;

  $: direction = currentQuestion?.direction ?? 'normal';
  $: sourceLanguage = currentQuestion?.sourceLanguage ?? $quizStore.quizManager?.getState().translations[0]?.sourceLanguage ?? '';
  $: targetLanguage = currentQuestion?.targetLanguage ?? $quizStore.quizManager?.getState().translations[0]?.targetLanguage ?? '';

  let currentLevel: string = 'LEVEL_1';
  let lastCurrentLevel: string = 'LEVEL_1';

  $: {
    const newLevel = $quizStore.quizManager?.getState().currentLevel || 'LEVEL_1';
    if (newLevel !== lastCurrentLevel) {
      lastCurrentLevel = newLevel;
      currentLevel = newLevel;
    }
  }

  $: currentLanguage = direction === 'normal' ? sourceLanguage : targetLanguage;
  $: canUseTTS = currentQuestion && ttsService.canUseTTS(currentLanguage);

  $: if (answerInput && currentQuestion) {
    answerInput.focus();
  }

  async function handleQuizSelect(event: CustomEvent<{ quiz: string }>): Promise<void> {
    const {quiz} = event.detail;

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
      await tick();
      if (answerInput) answerInput.focus();
    } catch (error: unknown) {
      console.error('Failed to start quiz:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to start quiz. Please try again.';
      feedback = { message: errorMessage, isSuccess: false } as QuizFeedback;
    }
  }

  function handleBackToMenu(): void {
    if ($authStore.token) {
      quizStore.saveAndCleanup($authStore.token).catch((error) => {
        console.error('Failed to save progress before returning to menu:', error);
      });
    }

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
      const result = await quizStore.submitAnswer($authStore.token!, userAnswer);

      if (result) {
        feedback = result;
        if ('translation' in result && result.translation) {
          usageExamples = {
            source: result.translation.sourceUsageExample || '',
            target: result.translation.targetUsageExample || '',
          };
        } else {
          usageExamples = null;
        }

        if ('levelChange' in result && result.levelChange) {
          const fromLevel = parseInt(result.levelChange.from.replace('LEVEL_', ''));
          const toLevel = parseInt(result.levelChange.to.replace('LEVEL_', ''));
          isLevelUp = toLevel > fromLevel;
          showLevelAnimation = true;
        }

        userAnswer = '';

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
    const unsubscribeTTS = ttsService.subscribe((state) => {
      ttsState = state;
    });

    (async () => {
      if ($authStore.token) {
        await ttsService.initializeLanguages($authStore.token);
        try {
          await quizStore.loadWordLists($authStore.token);
        } catch (error) {
          console.error('Failed to load word lists:', error);
        }
      }
      await tick();
      if (answerInput) answerInput.focus();
    })();

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

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  });

  onDestroy(() => {
    ttsService.destroy();
  });
</script>

{#key selectedQuiz}
  <main class="feed">
    <FeedCard title={selectedQuiz ? undefined : undefined}>
      {#if !selectedQuiz}
        <header class="flex-align-center gap-sm mb-md">
          <h1 class="logo"><i class="fas fa-language"></i> LinguaQuiz</h1>
        </header>
      {/if}
      <div class="stack">
        <QuizHeader
          {wordLists}
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
              <a href="https://github.com/nikolay-e/lingua-quiz/blob/main/CLAUDE.md#learning-algorithm" target="_blank" class="feature feature-link">
                ✨ Adaptive learning algorithm
              </a>
              <div class="feature">📊 Track your progress in real-time</div>
              <div class="feature">🎧 Listen to pronunciations</div>
            </div>
          </div>
        {/if}
      </div>
    </FeedCard>

    {#if selectedQuiz}
      <FeedCard dense title="Translate">
        <svelte:fragment slot="headerAction">
          {#if canUseTTS}
            <button
              class="btn-base {ttsState.isPlaying ? 'speaking' : ''}"
              on:click={() =>
                currentQuestion &&
                  ttsService.playTTS($authStore.token!, currentQuestion.questionText, currentLanguage)}
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

    {#if feedback}
      <FeedCard dense>
        <FeedbackDisplay
          {feedback}
          {usageExamples}
          {questionForFeedback}
        />
      </FeedCard>
    {/if}

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

<LevelChangeAnimation
  bind:isVisible={showLevelAnimation}
  {isLevelUp}
  on:complete={() => showLevelAnimation = false}
/>

<style>
  .delete-button {
    background-color: var(--error-color);
  }

  .delete-button:hover {
    background-color: var(--error-hover);
  }

  .logo {
    margin: 0;
    color: var(--primary-color);
    font-size: var(--font-size-xl);
  }

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
    box-shadow: var(--shadow-button-hover);
  }
</style>
