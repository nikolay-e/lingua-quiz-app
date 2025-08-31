<script lang="ts">
  import { authStore } from '../stores';
  import { createEventDispatcher } from 'svelte';

  // Import shared components
  import AuthLayout from '../components/AuthLayout.svelte';
  import PasswordInput from '../components/PasswordInput.svelte';
  import AuthMessage from '../components/AuthMessage.svelte';
  import AuthNavLink from '../components/AuthNavLink.svelte';

  const dispatch = createEventDispatcher<{ navigate: { page: 'register' } }>();

  // State variables
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
    } catch (error: any) {
      message = error.message;
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
      id="password"
    />

    <button type="submit" disabled={isLoading}>
      <i class="fas fa-sign-in-alt"></i> Sign In
    </button>
  </form>

  <AuthMessage {message} id="login-message" />

  <AuthNavLink
    text="Need an account?"
    linkText="Register here"
    onClick={navigateToRegister}
  />
</AuthLayout>
