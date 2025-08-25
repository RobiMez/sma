<script>
  import IdentificationCard from 'phosphor-svelte/lib/IdentificationCard';
</script>

<a href="/i" class="button">
  <IdentificationCard size={24} />
  Identities
</a>

<style lang="postcss">
  .button {
    @apply flex items-center justify-center gap-3 whitespace-nowrap rounded-sm border p-5 transition-all;
  }

  .button:hover {
    @apply bg-dark-700 dark:bg-light-base;
    @apply text-light-base dark:text-light-content;
  }
</style>
