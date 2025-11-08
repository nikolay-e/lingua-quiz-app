<script lang="ts">
  import { authStore } from '../stores';
  import { createEventDispatcher } from 'svelte';

  import AuthLayout from '../components/AuthLayout.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import AuthMessage from '../components/AuthMessage.svelte';
  import AuthNavLink from '../components/AuthNavLink.svelte';

  interface PasswordRequirement {
    id: string;
    label: string;
    test: (pwd: string) => boolean;
  }

  interface PasswordValidation extends PasswordRequirement {
    valid: boolean;
  }

  const dispatch = createEventDispatcher<{ navigate: { page: 'login' | 'register' } }>();

  let username = '';
  let password = '';
  let message = '';
  let isLoading = false;

  const passwordRequirements: PasswordRequirement[] = [
    { id: 'length', label: 'At least 8 characters long', test: (pwd: string) => pwd.length >= 8 },
    { id: 'uppercase', label: 'Contains at least one uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Contains at least one lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { id: 'number', label: 'Contains at least one number', test: (pwd: string) => /\d/.test(pwd) },
    { id: 'special', label: 'Contains at least one special character', test: (pwd: string) => /[!@#$%^&*()_\-+=[\]{};:'",.<>/?\\|`~]/.test(pwd) },
  ];

  $: passwordValidation = passwordRequirements.map(req => ({
    ...req,
    valid: req.test(password),
  })) as PasswordValidation[];

  $: isPasswordValid = passwordValidation.every((req: PasswordValidation) => req.valid);

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (!isPasswordValid) {
      message = 'Please meet all password requirements';
      return;
    }

    isLoading = true;
    message = '';

    try {
      await authStore.register(username, password);
      message = 'Registration successful! Redirecting...';
      username = '';
      password = '';
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : 'Registration failed. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function navigateToLogin() {
    dispatch('navigate', { page: 'login' });
  }
</script>

<AuthLayout>
  <h2>Create Account</h2>
  <form on:submit={handleSubmit} aria-busy={isLoading} class="form-compact">
    <div class="input-group">
      <input
        type="text"
        id="register-username"
        bind:value={username}
        placeholder="Username"
        required
        disabled={isLoading}
        autocomplete="username"
      />
    </div>

    <PasswordInput
      bind:value={password}
      disabled={isLoading}
      id="register-password"
      autocomplete="new-password"
    />

    {#if password}
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

    <button type="submit" disabled={!isPasswordValid || isLoading}>
      <i class="fas fa-user-plus"></i> Create Account
    </button>
  </form>

  <AuthMessage {message} variant={message.includes('successful') ? 'success' : 'error'} id="register-message" />

  <AuthNavLink
    text="Already have an account?"
    linkText="Sign in here"
    onClick={navigateToLogin}
  />
</AuthLayout>

<style>
  .password-requirements {
    background-color: var(--container-bg);
    border-radius: var(--radius-md);
    padding: 10px;
    margin-top: 10px;
    margin-bottom: 15px;
    box-shadow: var(--shadow-sm);
  }

  .password-requirements-title {
    margin-bottom: 5px;
    font-weight: bold;
  }

  .requirement {
    opacity: 0.8;
    transition: opacity var(--transition-speed) ease;
    display: flex;
    align-items: center;
    gap: 5px;
    margin: 3px 0;
  }

  .requirement:hover {
    opacity: 1;
  }

  .requirement-icon {
    transition:
      transform var(--transition-speed-fast) ease,
      color var(--transition-speed-fast) ease;
    color: var(--input-border-color);
    font-size: 12px;
  }

  .requirement.valid {
    color: var(--success-color);
    opacity: 1;
  }

  .requirement-icon.valid {
    color: var(--success-color);
    transform: scale(1.1);
  }
</style>
