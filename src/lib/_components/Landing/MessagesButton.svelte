<script lang="ts">
  import type { IKeyPairs } from '$lib/types';
  import { generateConsistentIndices } from '$lib/utils/colors';
  import Chat from 'phosphor-svelte/lib/Chat';

  interface Props {
    loadedPair: IKeyPairs;
  }

  let { loadedPair }: Props = $props();
</script>

<div class="relative">
  <a class="button" href="/li/{loadedPair?.uniqueString}">
    <Chat size={24} />

    Your Messages
  </a>
  <span
    class="absolute -bottom-2
    right-12 flex flex-row
    rounded-sm text-sm"
  >
    {#if loadedPair}
      {@const color = generateConsistentIndices(loadedPair.uniqueString)}
      <span
        class=" absolute -left-2 -top-4 aspect-square
    border border-light-300 p-1
    px-2 text-sm dark:border-dark-500"
        style="background: {color};"
      >
        &nbsp;
      </span>
      <span
        class="border-black absolute -top-4 left-1
    whitespace-nowrap border border-light-300 bg-dark-content
    p-1 px-2 text-sm dark:border-dark-500 dark:bg-light-content"
      >
        {loadedPair.uniqueString}
      </span>
    {/if}
  </span>
</div>

<style lang="postcss">
  .button {
    @apply flex items-center justify-center gap-3 whitespace-nowrap rounded-sm border p-5 transition-all;
  }

  .button:hover {
    @apply bg-dark-700 dark:bg-light-base;
    @apply text-light-base dark:text-light-content;
  }
</style>
