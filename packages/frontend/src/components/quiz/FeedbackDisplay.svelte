<script lang="ts">
  import { formatForDisplay, type SubmissionResult, type QuizQuestion } from '@lingua-quiz/core';
  import type { QuizFeedback } from '../../api-types';

  export let feedback: SubmissionResult | QuizFeedback | null = null;
  export let usageExamples: { source: string; target: string } | null = null;
  export let questionForFeedback: QuizQuestion | null = null;

  // Helper to determine if feedback indicates success
  $: isSuccess = feedback ? ('isSuccess' in feedback ? feedback.isSuccess : feedback.isCorrect) : false;

  // Helper to get the feedback message
  $: feedbackMessage = feedback
    ? ('message' in feedback
      ? feedback.message
      : `${questionForFeedback ? questionForFeedback.questionText : ''} = ${formatForDisplay(feedback.correctAnswerText)}`
    )
    : '';
</script>

{#if feedback}
  <div class="feedback-container" role="alert" aria-live="polite">
    <div class="feedback-text {isSuccess ? 'success' : 'error'} flex-center text-center">
      <span class="feedback-icon" aria-hidden="true"></span>
      <span class="feedback-message">
        {feedbackMessage}
      </span>
    </div>
    {#if usageExamples}
      <div class="usage-examples">
        <div class="example-container flex-col gap-sm">
          <p>{usageExamples.source}</p>
          <p>{usageExamples.target}</p>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .feedback-container {
    margin-top: var(--spacing-md);
    background-color: var(--container-bg);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    overflow: hidden;
  }

  .feedback-text {
    /* Using utility class equivalent: flex-center text-center */
    padding: var(--spacing-sm) 12px;
    font-weight: bold;
  }

  .feedback-text.success {
    color: var(--success-color);
  }

  .feedback-text.error {
    color: var(--error-color);
  }

  .feedback-icon {
    font-size: var(--font-size-lg);
    margin-right: var(--spacing-sm);
  }

  .feedback-text .feedback-icon::before {
    color: inherit;
  }

  .feedback-text.success .feedback-icon::before {
    content: '✓';
  }

  .feedback-text.error .feedback-icon::before {
    content: '✗';
  }

  .feedback-message {
    font-size: var(--font-size-base);
  }

  /* Usage Examples Styles */
  .usage-examples {
    padding: 6px 10px;
  }

  /* .example-container styles now handled by utility classes: flex-col gap-sm */

  .example-container p {
    background-color: var(--example-bg);
    padding: 5px;
    border-radius: var(--radius-md);
    margin: 0;
  }
</style>
