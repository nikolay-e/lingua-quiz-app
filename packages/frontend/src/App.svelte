<script lang="ts">
  import { onDestroy } from 'svelte';
  import { authStore, quizStore, themeStore } from './stores';
  import Login from './views/Login.svelte';
  import Register from './views/Register.svelte';
  import Quiz from './views/Quiz.svelte';
  import EnvironmentInfo from './components/EnvironmentInfo.svelte';
  import { PAGES, type PageType } from './lib/constants';

  let isAuthenticated = false;
  let currentPage: PageType = PAGES.LOGIN;

  const unsubscribe = authStore.subscribe(({ isAuthenticated: authenticated }) => {
    isAuthenticated = authenticated;
    if (!isAuthenticated) {
      quizStore.reset();
    }
  });

  const unsubscribeTheme = themeStore.subscribe(() => {
  });

  onDestroy(() => {
    unsubscribe();
    unsubscribeTheme();
  });

  function handleNavigation(event: CustomEvent<{ page: PageType }>) {
    currentPage = event.detail.page;
  }
</script>

{#key isAuthenticated}
  {#if isAuthenticated}
    <Quiz />
  {:else}
    {#key currentPage}
      {#if currentPage === PAGES.LOGIN}
        <Login on:navigate={handleNavigation} />
      {:else if currentPage === PAGES.REGISTER}
        <Register on:navigate={handleNavigation} />
      {/if}
    {/key}
  {/if}
{/key}

<EnvironmentInfo />
