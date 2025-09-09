<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import type { IKeyPairs } from '$lib/types';

  interface Props {
    identity: IKeyPairs;
    loadedPair?: IKeyPairs | undefined;
    onClick?: (identity: IKeyPairs) => void;
    classString?: string;
  }

  let { identity, loadedPair, onClick = () => {}, classString = '' }: Props = $props();
</script>

<button
  onclick={() => onClick(identity)}
  class=" {classString}
  inline-flex items-center justify-center border-2
  whitespace-nowrap transition-colors
  {loadedPair?.uniqueString === identity.uniqueString ? 'border-primary' : ' border-transparent'}"
>
  <span
    class="border-light-400 dark:border-dark-300 relative flex flex-row items-center justify-center rounded-xs border"
  >
    {#if identity.uniqueString}
      {@const color = generateConsistentIndices(identity.uniqueString)}
      <span class="flex flex-row items-center justify-center gap-2">
        <div class="inline-block aspect-square h-8 w-8 text-sm" style="background: {color};">
          &nbsp;
        </div>
        <span class="w-32 px-2 pr-1 text-left text-sm whitespace-nowrap">
          {identity.uniqueString}
        </span>
      </span>
    {/if}
    
  </span>
</button>
