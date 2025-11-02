<!-- Reusable authentication message component -->
<script lang="ts">
  export let message: string;
  export let variant: 'success' | 'error' | null = null;
  export let id: string = 'auth-message';

  $: messageColor =
    variant === 'success' ? 'var(--success-color)'
      : variant === 'error' ? 'var(--error-color)'
      : 'inherit';
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
