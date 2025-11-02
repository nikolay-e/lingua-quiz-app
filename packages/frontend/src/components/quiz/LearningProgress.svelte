<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { LEVEL_CONFIG } from '../../lib/config/levelConfig';
  import type { LevelWordLists } from '../../api-types';

  const dispatch = createEventDispatcher<{
    toggleFold: { levelId: string };
  }>();

  export let selectedQuiz: string | null | undefined = null;
  export let currentLevel: string = 'LEVEL_1';
  export let sourceLanguage: string = '';
  export let targetLanguage: string = '';
  export let levelWordLists: LevelWordLists = {};
  export let foldedLists: Record<string, boolean> = {};

  // Level configuration imported from @lingua-quiz/core

  function getLevelDescription(level: string): string {
    const levelConfig = LEVEL_CONFIG.find(config => config.key === level);
    return levelConfig?.description(sourceLanguage, targetLanguage) || '';
  }

  function handleToggleFold(levelId: string): void {
    dispatch('toggleFold', { levelId });
  }
</script>

<div class="learning-progress-container flex-col gap-lg">
  {#if selectedQuiz}
    <div class="current-level-display flex-align-center gap-sm">
      <span class="level-label">Current Practice Level:</span>
      <span class="level-description">{getLevelDescription(currentLevel)}</span>
    </div>
  {/if}

  <section class="learning-progress">
    {#each Object.values(levelWordLists) as levelData (levelData.id)}
      <div id="{levelData.id}" class="foldable-section">
        <button
          class="foldable-header btn-base"
          on:click={() => handleToggleFold(levelData.id)}
          aria-expanded={!foldedLists[levelData.id]}
        >
          <i class="fas fa-{foldedLists[levelData.id] ? 'chevron-right' : 'chevron-down'} fold-icon"></i>
          <i class="{levelData.icon}"></i> {levelData.label} ({levelData.count})
        </button>
        {#if !foldedLists[levelData.id]}
          {#if levelData.words.length > 0}
            <div class="foldable-content">
              <ol id="{levelData.id}-list" class="word-list">
                {#each levelData.words as word (word)}
                  <li class="word-item">{word}</li>
                {/each}
              </ol>
            </div>
          {:else}
            <div class="foldable-content">
              <p class="no-words text-center opacity-60 p-md">No words in this level yet.</p>
            </div>
          {/if}
        {/if}
      </div>
    {/each}
  </section>
</div>

<style>
  /* Current Level Display Styles */
  .current-level-display {
    background: var(--container-bg);
    border: 1px solid var(--input-border-color);
    border-radius: var(--radius-lg);
    padding: 12px var(--spacing-md);
    box-shadow: var(--shadow-sm);
    transition: box-shadow var(--transition-speed) ease;
  }

  .current-level-display:hover {
    box-shadow: var(--shadow-md);
  }

  .level-label {
    font-weight: 500;
    color: var(--text-color);
    font-size: var(--font-size-sm);
  }

  .level-description {
    font-weight: 600;
    color: var(--primary-color);
    font-size: var(--font-size-sm); /* Changed from hardcoded 0.95rem */
  }

  /* Learning Progress Styles */
  .learning-progress {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }

  .word-list {
    padding-left: 30px;
    margin-top: var(--spacing-sm);
  }

  .word-list li {
    padding: var(--spacing-xs) 0;
    border-bottom: 1px solid var(--input-border-color);
    margin: var(--spacing-xs) 0;
  }

  .no-words {
    font-style: italic;
  }

  /* Foldable Sections Styles - using standardized classes */

  .foldable-header {
    cursor: pointer;
    user-select: none;
  }

  .fold-icon {
    font-size: 0.8rem;
    margin-right: var(--spacing-sm);
    transition: transform var(--transition-speed-fast) ease;
    color: var(--text-color);
    opacity: 0.6;
  }

  .foldable-content {
    animation: fade-in var(--transition-speed) ease;
    margin-top: var(--spacing-sm);
  }

  /* Animations */
  @keyframes fade-in {
    from {
      opacity: 0;
    }

    to {
      opacity: 1;
    }
  }
</style>
