<!-- Reusable password input component with toggle visibility -->
<script lang="ts">
  export let value: string;
  export let placeholder: string = 'Password';
  export let disabled: boolean = false;
  export let id: string = 'password';
  export let label: string = '';
  export let autocomplete: 'current-password' | 'new-password' = 'current-password';

  let showPassword = false;

  function togglePasswordVisibility() {
    showPassword = !showPassword;
  }
</script>

<div class="input-group">
  {#if label}
    <label for={id}>{label}</label>
  {/if}
  <input
    type={showPassword ? 'text' : 'password'}
    bind:value
    {placeholder}
    required
    {disabled}
    {id}
    {autocomplete}
  />
  <button
    type="button"
    class="toggle-password-btn"
    on:click={togglePasswordVisibility}
    aria-label={showPassword ? 'Hide password' : 'Show password'}
  >
    <i class="fas fa-eye{showPassword ? '-slash' : ''}"></i>
  </button>
</div>
