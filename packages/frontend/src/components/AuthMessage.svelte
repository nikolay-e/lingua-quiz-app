<script lang="ts">
  export let message: string;
  export let variant: 'success' | 'error' | null = null;
  export let id: string = 'auth-message';

  $: {
    if (variant === 'success') {
      messageColor = 'var(--success-color)';
    } else if (variant === 'error') {
      messageColor = 'var(--error-color)';
    } else {
      messageColor = 'inherit';
    }
  }
  let messageColor = 'inherit';
</script>

{#if message}
  <p
    {id}
    style:color={messageColor}
    role="status"
    aria-live="polite">
    {message}
  </p>
{/if}
