<script>
  import { onDestroy } from 'svelte';
  import { authStore, quizStore } from './stores.js';
  import Login from './views/Login.svelte';
  import Register from './views/Register.svelte';
  import Quiz from './views/Quiz.svelte';
  
  let isAuthenticated = false;
  let currentPage = 'login';
  
  authStore.subscribe(state => {
    isAuthenticated = state.isAuthenticated;
    if (!isAuthenticated) {
      quizStore.reset();
    }
  });
  
  onDestroy(() => {
    authStore.cleanup();
  });
  
  function handleNavigation(event) {
    currentPage = event.detail.page;
  }
</script>

{#if isAuthenticated}
  <Quiz />
{:else}
  {#if currentPage === 'login'}
    <Login on:navigate={handleNavigation} />
  {:else if currentPage === 'register'}
    <Register on:navigate={handleNavigation} />
  {/if}
{/if}