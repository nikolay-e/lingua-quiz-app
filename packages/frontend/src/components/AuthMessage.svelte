<!-- Reusable authentication message component -->
<script lang="ts">
  export let message: string;
  export let id: string = 'auth-message';

  $: isSuccess = message.includes('successful');
  $: messageColor = isSuccess ? 'var(--success-color)' : 'var(--error-color)';
</script>

{#if message}
  <p {id} style:color={messageColor}>
    {message}
  </p>
{/if}
