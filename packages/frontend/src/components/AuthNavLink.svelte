<!-- Reusable authentication navigation link component -->
<script lang="ts">
  export let text: string;
  export let linkText: string;
  export let onClick: () => void;
</script>

<div class="auth-link">
  <p>{text} <button on:click={onClick} class="link-button">{linkText}</button></p>
</div>

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
