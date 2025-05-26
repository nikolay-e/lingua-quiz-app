<script>
  import { onDestroy } from 'svelte';
  import { authStore, quizStore } from './stores.js';
  import Login from './views/Login.svelte';
  import Quiz from './views/Quiz.svelte';
  
  let isAuthenticated = false;
  
  authStore.subscribe(state => {
    isAuthenticated = state.isAuthenticated;
    if (!isAuthenticated) {
      quizStore.reset();
    }
  });
  
  onDestroy(() => {
    authStore.cleanup();
  });
</script>

{#if isAuthenticated}
  <Quiz />
{:else}
  <Login />
{/if}