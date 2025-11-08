<script lang="ts">
  import type { QuizQuestion } from '@lingua-quiz/core';

  export let currentQuestion: QuizQuestion | null = null;
</script>

{#if currentQuestion}
  <div class="question">
    <span id="word" class="question-text">
      {currentQuestion.questionText}
    </span>
  </div>
{:else}
  <div class="question">
    <span id="word" class="question-text">No more questions available.</span>
  </div>
{/if}

<style>
  .question {
    padding: var(--spacing-sm) var(--spacing-md);
    background: linear-gradient(135deg, var(--feature-gradient-start), var(--feature-gradient-end));
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .question-text {
    font-size: var(--font-size-2xl);
    font-weight: bold;
    color: var(--secondary-color);
    text-align: center;
  }
</style>
