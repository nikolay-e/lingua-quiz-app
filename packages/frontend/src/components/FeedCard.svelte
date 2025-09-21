<script lang="ts">
  export let title: string | null = null;
  export let subtitle: string | null = null;
  export let dense: boolean = false; // tighter padding for small elements
</script>

<article class="feed-item {dense ? 'dense' : ''}">
  {#if title || subtitle || $$slots.headerAction}
    <header class="feed-item__header">
      <div class="header-content">
        <div class="header-text">
          {#if title}<h3>{title}</h3>{/if}
          {#if subtitle}<p class="subtitle">{subtitle}</p>{/if}
        </div>
        {#if $$slots.headerAction}
          <div class="header-action">
            <slot name="headerAction" />
          </div>
        {/if}
      </div>
    </header>
  {/if}
  <div class="feed-item__body">
    <slot />
  </div>
</article>

<style>
  .feed-item {
    background: var(--container-bg);
    border: 1px solid var(--input-border-color);
    border-radius: var(--radius-xl);
    box-shadow: 0 2px 6px var(--shadow-color);
    padding: var(--spacing-lg);
  }
  .feed-item.dense {
    padding: var(--spacing-md);
  }
  .feed-item__header {
    margin-bottom: var(--spacing-sm);
  }
  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .header-text h3 {
    margin: 0 0 2px 0;
    color: var(--text-color);
    font-size: var(--font-size-lg);
  }
  .header-text .subtitle {
    margin: 0;
    opacity: 0.8;
    font-size: var(--font-size-sm);
  }
  .header-action :global(button) {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    background: none;
    border: 1px solid var(--input-border-color);
    color: var(--text-color);
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--radius-sm);
    cursor: pointer;
    transition: all var(--transition-speed) ease;
    font-size: var(--font-size-sm);
    margin: 0;
    width: auto;
  }
  .header-action :global(button:hover) {
    background-color: var(--hover-bg-light);
    border-color: var(--primary-color);
    color: var(--primary-color);
  }
  .feed-item__body :global(.full-width) {
    width: 100%;
  }
</style>
