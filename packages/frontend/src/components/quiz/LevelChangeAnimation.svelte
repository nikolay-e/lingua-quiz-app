<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let isVisible = false;
  export let isLevelUp = true;

  const dispatch = createEventDispatcher();

  let animationElement: HTMLDivElement;

  $: if (isVisible && animationElement) {
    // Reset animation
    animationElement.style.animation = 'none';
    animationElement.offsetHeight; // Trigger reflow
    animationElement.style.animation = null;

    // Auto-hide after animation
    setTimeout(() => {
      dispatch('complete');
    }, 1500);
  }
</script>

{#if isVisible}
  <div
    bind:this={animationElement}
    class="level-change-animation {isLevelUp ? 'level-up' : 'level-down'}"
    role="alert"
    aria-live="polite"
  >
    <div class="animation-content">
      <div class="icon">{isLevelUp ? '⬆️' : '⬇️'}</div>
      <div class="text">{isLevelUp ? 'Level Up!' : 'Level Down'}</div>
    </div>
  </div>
{/if}

<style>
  .level-change-animation {
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1000;
    pointer-events: none;
  }

  .level-up {
    animation: level-up-animation 1.5s ease-out forwards;
  }

  .level-down {
    animation: level-down-animation 1.5s ease-out forwards;
  }

  .animation-content {
    background: rgb(255 255 255 / 95%);
    border-radius: 12px;
    padding: 16px 24px;
    box-shadow: var(--shadow-xl);
    backdrop-filter: blur(10px);
    border: 2px solid;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
  }

  .level-up .animation-content {
    border-color: var(--level-up-border);
    color: var(--level-up-text);
  }

  .level-down .animation-content {
    border-color: var(--level-down-border);
    color: var(--level-down-text);
  }

  .icon {
    font-size: 24px;
  }

  .text {
    font-size: 18px;
  }

  @keyframes level-up-animation {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }

    20% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 1;
    }

    40% {
      transform: translate(-50%, -50%) scale(1);
    }

    100% {
      transform: translate(-50%, -60%) scale(1);
      opacity: 0;
    }
  }

  @keyframes level-down-animation {
    0% {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }

    20% {
      transform: translate(-50%, -50%) scale(1.2);
      opacity: 1;
    }

    40% {
      transform: translate(-50%, -50%) scale(1);
    }

    100% {
      transform: translate(-50%, -40%) scale(1);
      opacity: 0;
    }
  }
</style>
