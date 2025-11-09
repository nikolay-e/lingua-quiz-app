<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { WordList } from '../../api-types';

  const dispatch = createEventDispatcher<{ select: { quiz: string }; backToMenu: void }>();

  export let wordLists: WordList[] = [];
  export let selectedQuiz: string | null = null;
  export let loading: boolean = false;

  let selected = '';

  function handleQuizSelect(): void {
    if (!selected) return;
    dispatch('select', { quiz: selected });
  }

  function handleBackToMenu(): void {
    dispatch('backToMenu');
  }
</script>

<div class="quiz-header">
  {#if !selectedQuiz}
    <div class="quiz-select-container">
      <select
        id="quiz-select"
        class="quiz-select"
        bind:value={selected}
        on:change={handleQuizSelect}
        disabled={loading}
      >
        <option value="" disabled>
          {loading ? 'Loading quizzes...' : '🎯 Select a quiz to start learning'}
        </option>
        {#each wordLists as list (list.listName)}
          <option value={list.listName}>{list.listName}</option>
        {/each}
      </select>
    </div>
  {:else}
    <div class="selected-quiz-header flex-between">
      <div class="quiz-info flex-align-center gap-sm">
        <i class="fas fa-book"></i>
        <span class="quiz-name">{selectedQuiz}</span>
      </div>
      <button class="btn-base" on:click={handleBackToMenu}>
        <i class="fas fa-arrow-left"></i>
        <span>Back to Menu</span>
      </button>
    </div>
  {/if}
</div>

<style>
  .quiz-header {
    margin-top: calc(var(--spacing-md) * -0.5);
  }

  .quiz-select-container {
    margin-top: var(--spacing-md);
  }

  .quiz-select {
    background-color: var(--container-bg);
    color: var(--text-color);
    border: 2px solid var(--input-border-color);
    border-radius: var(--radius-md);
    padding: var(--spacing-sm);
    font-size: var(--font-size-base);
    transition: border-color var(--transition-speed) ease;
  }

  .quiz-select:focus {
    border-color: var(--primary-color);
    box-shadow: var(--shadow-focus);
  }

  .quiz-select:disabled {
    background-color: var(--disabled-bg);
    color: var(--disabled-text);
    border-color: var(--disabled-border-color);
    cursor: not-allowed;
  }

  .selected-quiz-header {
    margin-top: var(--spacing-md);
  }

  .quiz-info i {
    color: var(--primary-color);
  }

  .quiz-name {
    font-weight: 600;
    color: var(--primary-color);
    font-size: var(--font-size-lg);
  }

  .btn-base {
    gap: var(--spacing-xs);
    margin: 0;
    width: auto;
  }
</style>
