<script>
  import { authStore } from '../stores.js';
  
  let loginEmail = '';
  let loginPassword = '';
  let registerEmail = '';
  let registerPassword = '';
  let loginMessage = '';
  let registerMessage = '';
  let showLoginPassword = false;
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
  
  async function handleLogin(e) {
    e.preventDefault();
    isLoading = true;
    loginMessage = '';
    
    try {
      await authStore.login(loginEmail, loginPassword);
      loginMessage = 'Login successful!';
    } catch (error) {
      loginMessage = error.message;
    } finally {
      isLoading = false;
    }
  }
  
  async function handleRegister(e) {
    e.preventDefault();
    if (!isPasswordValid) {
      registerMessage = 'Please meet all password requirements';
      return;
    }
    
    isLoading = true;
    registerMessage = '';
    
    try {
      await authStore.register(registerEmail, registerPassword);
      registerMessage = 'Registration successful. You can now log in.';
      registerEmail = '';
      registerPassword = '';
    } catch (error) {
      registerMessage = error.message;
    } finally {
      isLoading = false;
    }
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
      <h2>Login</h2>
      <form on:submit={handleLogin}>
        <div class="input-group">
          <input 
            type="email" 
            bind:value={loginEmail} 
            placeholder="Email" 
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
          <i class="fas fa-sign-in-alt"></i> Login
        </button>
      </form>
      {#if loginMessage}
        <p id="login-message" style:color={loginMessage.includes('successful') ? 'var(--success-color)' : 'var(--error-color)'}>
          {loginMessage}
        </p>
      {/if}
    </section>

    <section class="sidebar-section">
      <h2>Register</h2>
      <form on:submit={handleRegister}>
        <div class="input-group">
          <input 
            type="email" 
            bind:value={registerEmail} 
            placeholder="Email" 
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
          <i class="fas fa-user-plus"></i> Register
        </button>
      </form>
      {#if registerMessage}
        <p id="register-message" style:color={registerMessage.includes('successful') ? 'var(--success-color)' : 'var(--error-color)'}>
          {registerMessage}
        </p>
      {/if}
    </section>
  </div>
  
  <div class="right-sidebar"></div>
</main>