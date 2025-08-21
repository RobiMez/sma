<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import type { IKeyPairs, LoadedPair } from '$lib/types';

  interface Props {
    identity: IKeyPairs;
    loadedPair: LoadedPair | undefined;
    onClick: (identity: IKeyPairs) => void;
  }

  let { identity, loadedPair, onClick }: Props = $props();
</script>

<button
  onclick={() => onClick(identity)}
  class="
  inline-flex items-center justify-center whitespace-nowrap
  border-2 transition-colors
  {loadedPair?.uniqueString === identity.uniqueString
    ? 'border-light-900 dark:border-dark-100'
    : ' border-[#00000000]'}"
>
  <span
    class="relative flex flex-row items-center justify-center rounded-sm border border-light-400 dark:border-dark-300"
  >
    {#if identity.uniqueString}
      {@const color = generateConsistentIndices(identity.uniqueString)}
      <span class="flex flex-row items-center justify-center gap-2">
        <div class="inline-block aspect-square h-8 w-8 text-sm" style="background: {color};">
          &nbsp;
        </div>
        <span class="w-32 whitespace-nowrap px-2 pr-1 text-left text-sm">
          {identity.uniqueString}
        </span>
      </span>
    {/if}
  </span>
</button>
