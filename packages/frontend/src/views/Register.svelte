<script>
  import { authStore } from '../stores.js';
  import { createEventDispatcher } from 'svelte';
  
  const dispatch = createEventDispatcher();
  
  let registerUsername = '';
  let registerPassword = '';
  let registerMessage = '';
  let showRegisterPassword = false;
  let isLoading = false;
  
  const passwordRequirements = [
    { id: 'length', label: 'At least 8 characters long', test: pwd => pwd.length >= 8 },
    { id: 'uppercase', label: 'Contains at least one uppercase letter', test: pwd => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Contains at least one lowercase letter', test: pwd => /[a-z]/.test(pwd) },
    { id: 'number', label: 'Contains at least one number', test: pwd => /\d/.test(pwd) },
    { id: 'special', label: 'Contains at least one special character', test: pwd => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
  ];
  
  $: passwordValidation = passwordRequirements.map(req => ({
    ...req,
    valid: req.test(registerPassword)
  }));
  
  $: isPasswordValid = passwordValidation.every(req => req.valid);
  
  async function handleRegister(e) {
    e.preventDefault();
    if (!isPasswordValid) {
      registerMessage = 'Please meet all password requirements';
      return;
    }
    
    isLoading = true;
    registerMessage = '';
    
    try {
      await authStore.register(registerUsername, registerPassword);
      registerMessage = 'Registration successful! Redirecting...';
      registerUsername = '';
      registerPassword = '';
      // Auto-login successful - redirect to quiz page
      setTimeout(() => {
        dispatch('navigate', { page: 'quiz' });
      }, 1000);
    } catch (error) {
      registerMessage = error.message;
    } finally {
      isLoading = false;
    }
  }
  
  function navigateToLogin() {
    dispatch('navigate', { page: 'login' });
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
      <h2>Create Account</h2>
      <form on:submit={handleRegister}>
        <div class="input-group">
          <input 
            type="text" 
            bind:value={registerUsername} 
            placeholder="Username" 
            required 
            disabled={isLoading}
          />
        </div>
        <div class="input-group">
          {#if showRegisterPassword}
            <input 
              type="text" 
              bind:value={registerPassword} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="register-password"
            />
          {:else}
            <input 
              type="password" 
              bind:value={registerPassword} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="register-password"
            />
          {/if}
          <button 
            type="button" 
            class="toggle-password-btn"
            on:click={() => showRegisterPassword = !showRegisterPassword}
          >
            <i class="fas fa-eye{showRegisterPassword ? '-slash' : ''}"></i>
          </button>
        </div>
        
        {#if registerPassword}
          <div class="password-requirements">
            <div class="password-requirements-title">Password Requirements:</div>
            <div class="requirements-list">
              {#each passwordValidation as req}
                <div class="requirement {req.valid ? 'valid' : ''}">
                  <span class="requirement-icon {req.valid ? 'valid' : ''}">
                    {req.valid ? '✓' : '○'}
                  </span>
                  <span>{req.label}</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
        
        <button type="submit" disabled={!isPasswordValid || isLoading}>
          <i class="fas fa-user-plus"></i> Create Account
        </button>
      </form>
      {#if registerMessage}
        <p id="register-message" style:color={registerMessage.includes('successful') ? 'var(--success-color)' : 'var(--error-color)'}>
          {registerMessage}
        </p>
      {/if}
      
      <div class="auth-link">
        <p>Already have an account? <button on:click={navigateToLogin} class="link-button">Sign in here</button></p>
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