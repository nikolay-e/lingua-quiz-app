<script>
  import { authStore } from '../stores.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let loginUsername = '';
  let loginPassword = '';
  let loginMessage = '';
  let showLoginPassword = false;
  let isLoading = false;
  
  async function handleLogin(e) {
    e.preventDefault();
    isLoading = true;
    loginMessage = '';
    
    try {
      await authStore.login(loginUsername, loginPassword);
      loginMessage = 'Login successful!';
    } catch (error) {
      loginMessage = error.message;
    } finally {
      isLoading = false;
    }
  }
  
  function navigateToRegister() {
    dispatch('navigate', { page: 'register' });
  }
</script>

<main class="container login-container">
  <div class="left-sidebar">
    <header>
      <h1><i class="fas fa-language"></i> LinguaQuiz</h1>
    </header>
  </div>
  
  <div class="main-content login-content">
    <section class="sidebar-section">
      <h2>Sign In</h2>
      <form on:submit={handleLogin}>
        <div class="input-group">
          <input 
            type="text" 
            bind:value={loginUsername} 
            placeholder="Username" 
            required 
            disabled={isLoading}
          />
        </div>
        <div class="input-group">
          {#if showLoginPassword}
            <input 
              type="text" 
              bind:value={loginPassword} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="password"
            />
          {:else}
            <input 
              type="password" 
              bind:value={loginPassword} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="password"
            />
          {/if}
          <button 
            type="button" 
            class="toggle-password-btn"
            on:click={() => showLoginPassword = !showLoginPassword}
          >
            <i class="fas fa-eye{showLoginPassword ? '-slash' : ''}"></i>
          </button>
        </div>
        <button type="submit" disabled={isLoading}>
          <i class="fas fa-sign-in-alt"></i> Sign In
        </button>
      </form>
      {#if loginMessage}
        <p id="login-message" style:color={loginMessage.includes('successful') ? 'var(--success-color)' : 'var(--error-color)'}>
          {loginMessage}
        </p>
      {/if}
      
      <div class="auth-link">
        <p>Need an account? <button on:click={navigateToRegister} class="link-button">Register here</button></p>
      </div>
    </section>
  </div>
  
  <div class="right-sidebar"></div>
</main>

<style>
  .auth-link {
    margin-top: 20px;
    text-align: center;
    color: var(--text-color);
  }
  
  .link-button {
    background: none;
    border: none;
    color: var(--primary-color);
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    margin: 0;
    font-size: inherit;
    width: auto;
  }
  
  .link-button:hover {
    color: var(--secondary-color);
    background: none;
  }
</style>