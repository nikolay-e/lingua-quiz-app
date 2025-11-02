<script lang="ts">
  import FeedCard from './FeedCard.svelte';
</script>

<main class="feed">
  <FeedCard dense>
    <header>
      <h1><i class="fas fa-language"></i> LinguaQuiz</h1>
    </header>
  </FeedCard>

  <FeedCard>
    <slot />
  </FeedCard>
</main>

<style>
  header {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  h1 {
    margin: 0;
  }
</style>
