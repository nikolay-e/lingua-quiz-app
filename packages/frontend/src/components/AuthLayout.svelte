<script lang="ts">
  import FeedCard from './FeedCard.svelte';
</script>

<main class="feed">
  <FeedCard dense>
    <header style="display:flex;align-items:center;gap:10px;">
      <h1 style="margin:0;"><i class="fas fa-language"></i> LinguaQuiz</h1>
    </header>
  </FeedCard>

  <FeedCard>
    <slot />
  </FeedCard>
</main>
