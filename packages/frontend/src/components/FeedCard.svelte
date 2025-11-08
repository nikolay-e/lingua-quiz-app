<script lang="ts">
  export let title: string | null = null;
  export let subtitle: string | null = null;
  export let dense: boolean = false;
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
    box-shadow: var(--shadow-md);
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
    margin: 0 0 2px;
    color: var(--text-color);
    font-size: var(--font-size-lg);
  }

  .header-text .subtitle {
    margin: 0;
    opacity: 0.8;
    font-size: var(--font-size-sm);
  }

  .header-action :global(.btn-base) {
    gap: var(--spacing-xs);
    margin: 0;
    width: auto;
  }

  .feed-item__body :global(.full-width) {
    width: 100%;
  }
</style>
