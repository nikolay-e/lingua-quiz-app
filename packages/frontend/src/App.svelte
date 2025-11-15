<script lang="ts">
  import { onDestroy } from 'svelte';
  import { authStore, quizStore, themeStore } from './stores';
  import Login from './views/Login.svelte';
  import Register from './views/Register.svelte';
  import Quiz from './views/Quiz.svelte';
  import Admin from './views/Admin.svelte';
  import EnvironmentInfo from './components/EnvironmentInfo.svelte';
  import { PAGES, type PageType } from './lib/constants';

  let isAuthenticated = false;
  let isAdmin = false;
  let currentPage: PageType = PAGES.LOGIN;

  const unsubscribe = authStore.subscribe(({ isAuthenticated: authenticated, isAdmin: adminStatus }) => {
    isAuthenticated = authenticated;
    isAdmin = adminStatus;
    if (!isAuthenticated) {
      quizStore.reset();
      currentPage = PAGES.LOGIN;
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

  function navigateToQuiz() {
    currentPage = PAGES.LOGIN;
  }

  function navigateToAdmin() {
    if (isAdmin) {
      currentPage = PAGES.ADMIN;
    }
  }
</script>

{#key isAuthenticated}
  {#if isAuthenticated}
    {#if currentPage === PAGES.ADMIN && isAdmin}
      <div class="admin-nav">
        <button on:click={navigateToQuiz}>Back to Quiz</button>
      </div>
      <Admin />
    {:else}
      {#if isAdmin}
        <div class="admin-nav">
          <button on:click={navigateToAdmin}>Admin Panel</button>
        </div>
      {/if}
      <Quiz />
    {/if}
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

<style>
  .admin-nav {
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 1000;
  }

  .admin-nav button {
    padding: 10px 20px;
    background-color: #6c757d;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  }

  .admin-nav button:hover {
    background-color: #5a6268;
  }
</style>
