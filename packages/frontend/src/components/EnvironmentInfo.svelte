<script lang="ts">
  const environment = import.meta.env.VITE_APP_ENVIRONMENT || 'development';
  const version = import.meta.env.VITE_APP_VERSION || 'dev';
</script>

<div class="environment-info">
  <span
    class="env-label"
    class:production={environment === 'production'}
    class:staging={environment === 'staging'}
    class:preview={environment.startsWith('preview')}>
    {environment}
  </span>
  <span class="version">v{version}</span>
</div>

<style>
  .environment-info {
    position: fixed;
    bottom: 8px;
    right: 8px;
    display: flex;
    gap: 8px;
    font-size: 11px;
    font-family: monospace;
    z-index: 1000;
    opacity: 0.6;
    transition: opacity 0.2s;
  }

  .environment-info:hover {
    opacity: 1;
  }

  .env-label,
  .version {
    padding: 4px 8px;
    border-radius: 4px;
    background: var(--bg-secondary, #f0f0f0);
    color: var(--text-primary, #333);
  }

  .env-label.production {
    background: #10b981;
    color: white;
  }

  .env-label.staging {
    background: #f59e0b;
    color: white;
  }

  .env-label.preview {
    background: #3b82f6;
    color: white;
  }

  .version {
    background: var(--bg-tertiary, #e5e5e5);
  }

  @media (prefers-color-scheme: dark) {
    .env-label,
    .version {
      background: var(--bg-secondary-dark, #2a2a2a);
      color: var(--text-primary-dark, #e0e0e0);
    }

    .version {
      background: var(--bg-tertiary-dark, #1a1a1a);
    }
  }
</style>
