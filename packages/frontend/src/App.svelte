<script lang="ts">
  import { onDestroy } from 'svelte';
  import { authStore, quizStore } from './stores';
  import Auth from './views/Auth.svelte';
  import Quiz from './views/Quiz.svelte';
  
  let isAuthenticated = false;
  const currentAuthMode: 'login' | 'register' = 'login';
  
  const unsubscribe = authStore.subscribe(state => {
    isAuthenticated = state.isAuthenticated;
    if (!isAuthenticated) {
      quizStore.reset();
    }
  });
  
  onDestroy(() => {
    unsubscribe();
  });
</script>

{#if isAuthenticated}
  <Quiz />
{:else}
  <Auth mode={currentAuthMode} />
{/if}