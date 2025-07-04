<script lang="ts">
  import { authStore } from '../stores';
  import { createEventDispatcher } from 'svelte';
  
  export let mode: 'login' | 'register' = 'login';
  
  interface PasswordRequirement {
    id: string;
    label: string;
    test: (pwd: string) => boolean;
  }

  interface PasswordValidation extends PasswordRequirement {
    valid: boolean;
  }

  const _dispatch = createEventDispatcher<{ navigate: { page: 'login' | 'register' } }>();
  
  let username = '';
  let password = '';
  let message = '';
  let showPassword = false;
  let isLoading = false;
  
  const passwordRequirements: PasswordRequirement[] = [
    { id: 'length', label: 'At least 8 characters long', test: (pwd: string) => pwd.length >= 8 },
    { id: 'uppercase', label: 'Contains at least one uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Contains at least one lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { id: 'number', label: 'Contains at least one number', test: (pwd: string) => /\d/.test(pwd) },
    { id: 'special', label: 'Contains at least one special character', test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
  ];
  
  $: passwordValidation = passwordRequirements.map(req => ({
    ...req,
    valid: req.test(password)
  })) as PasswordValidation[];
  
  $: isPasswordValid = passwordValidation.every((req: PasswordValidation) => req.valid);
  
  async function handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    
    if (mode === 'register' && !isPasswordValid) {
      message = 'Please meet all password requirements';
      return;
    }
    
    isLoading = true;
    message = '';
    
    try {
      if (mode === 'login') {
        await authStore.login(username, password);
        message = 'Login successful!';
      } else {
        await authStore.register(username, password);
        message = 'Registration successful! Redirecting...';
        username = '';
        password = '';
      }
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  }
  
  function toggleMode(): void {
    mode = mode === 'login' ? 'register' : 'login';
    message = '';
    username = '';
    password = '';
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
      <h2>{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
      <form on:submit={handleSubmit}>
        <div class="input-group">
          <input 
            type="text" 
            bind:value={username} 
            placeholder="Username" 
            required 
            disabled={isLoading}
          />
        </div>
        <div class="input-group">
          {#if showPassword}
            <input 
              type="text" 
              bind:value={password} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="password"
            />
          {:else}
            <input 
              type="password" 
              bind:value={password} 
              placeholder="Password" 
              required 
              disabled={isLoading}
              id="password"
            />
          {/if}
          <button 
            type="button" 
            class="toggle-password-btn"
            on:click={() => showPassword = !showPassword}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            <i class="fas fa-eye{showPassword ? '-slash' : ''}"></i>
          </button>
        </div>
        
        {#if mode === 'register' && password}
          <div class="password-requirements">
            <div class="password-requirements-title">Password Requirements:</div>
            <div class="requirements-list">
              {#each passwordValidation as req (req.label)}
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
        
        <button type="submit" disabled={isLoading || (mode === 'register' && !isPasswordValid)}>
          <i class="fas fa-{mode === 'login' ? 'sign-in-alt' : 'user-plus'}"></i> 
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      {#if message}
        <p id="{mode}-message" style:color={message.includes('successful') ? 'var(--success-color)' : 'var(--error-color)'}>
          {message}
        </p>
      {/if}
      
      <div class="auth-link">
        {#if mode === 'login'}
          <p>Need an account? <button on:click={toggleMode} class="link-button">Register here</button></p>
        {:else}
          <p>Already have an account? <button on:click={toggleMode} class="link-button">Sign in here</button></p>
        {/if}
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