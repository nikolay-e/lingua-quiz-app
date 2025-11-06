<script lang="ts">
  import { authStore } from '../stores';
  import { createEventDispatcher } from 'svelte';
  import AuthLayout from '../components/AuthLayout.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import AuthMessage from '../components/AuthMessage.svelte';
  import AuthNavLink from '../components/AuthNavLink.svelte';

  const dispatch = createEventDispatcher<{ navigate: { page: 'register' } }>();

  let username = '';
  let password = '';
  let message = '';
  let isLoading = false;

  async function handleSubmit(e: Event) {
    e.preventDefault();
    isLoading = true;
    message = '';

    try {
      await authStore.login(username, password);
      message = 'Login successful!';
    } catch (error: unknown) {
      message = error instanceof Error ? error.message : 'Login failed. Please try again.';
    } finally {
      isLoading = false;
    }
  }

  function navigateToRegister() {
    dispatch('navigate', { page: 'register' });
  }
</script>

<AuthLayout>
  <h2>Sign In</h2>
  <form on:submit={handleSubmit} aria-busy={isLoading} class="form-compact">
    <div class="input-group">
      <input
        type="text"
        id="username"
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
      id="password"
      autocomplete="current-password"
    />

    <button type="submit" disabled={isLoading}>
      <i class="fas fa-sign-in-alt"></i> Sign In
    </button>
  </form>

  <AuthMessage {message} variant={message.includes('successful') ? 'success' : 'error'} id="login-message" />

  <AuthNavLink
    text="Need an account?"
    linkText="Register here"
    onClick={navigateToRegister}
  />
</AuthLayout>
