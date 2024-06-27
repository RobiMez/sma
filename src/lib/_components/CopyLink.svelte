<script lang="ts">
  import CheckFat from 'phosphor-svelte/lib/CheckFat';
  import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';
  import { scale } from 'svelte/transition';

  export let copied = false;
</script>

<button
  class="py-auto min-w-18 max-w-18
			dark:text-dark-200
			flex aspect-square
			flex-row items-center
			justify-center overflow-clip rounded-sm bg-light-200 dark:bg-dark-900
		"
  on:click
>
  <span class="relative flex w-full flex-row items-center justify-center text-xs">
    {#if copied}
      <span in:scale={{ start: 0.9 }} class="flex flex-col items-center justify-center gap-2">
        <span>
          <CheckFat size={20} weight="duotone" />
        </span>
        <span class=" bottom-1 whitespace-nowrap text-xs  lg:flex">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {:else}
      <span in:scale={{ start: 0.9 }} class="flex flex-col items-center justify-center gap-2">
        <span>
          <ShareNetwork size={20} weight="duotone" />
        </span>
        <span class=" bottom-1 whitespace-nowrap text-xs  lg:flex">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {/if}
  </span>
</button>
