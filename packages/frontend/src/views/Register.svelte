<script lang="ts">
  import { authStore } from '../stores';
  import { createEventDispatcher } from 'svelte';

  // Import shared components
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

  // State variables
  let username = '';
  let password = '';
  let message = '';
  let isLoading = false;

  // Password requirements configuration (data-driven)
  const passwordRequirements: PasswordRequirement[] = [
    { id: 'length', label: 'At least 8 characters long', test: (pwd: string) => pwd.length >= 8 },
    { id: 'uppercase', label: 'Contains at least one uppercase letter', test: (pwd: string) => /[A-Z]/.test(pwd) },
    { id: 'lowercase', label: 'Contains at least one lowercase letter', test: (pwd: string) => /[a-z]/.test(pwd) },
    { id: 'number', label: 'Contains at least one number', test: (pwd: string) => /\d/.test(pwd) },
    { id: 'special', label: 'Contains at least one special character', test: (pwd: string) => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
  ];

  // Reactive password validation (data-driven)
  $: passwordValidation = passwordRequirements.map(req => ({
    ...req,
    valid: req.test(password)
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
    } catch (error: any) {
      message = error.message;
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

    <PasswordInput
      bind:value={password}
      disabled={isLoading}
      id="register-password"
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

  <AuthMessage {message} id="register-message" />

  <AuthNavLink
    text="Already have an account?"
    linkText="Sign in here"
    onClick={navigateToLogin}
  />
</AuthLayout>
