<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import BlurhashThumbnail from './BlurhashThumbnail.svelte';

  export let msg: any;
  const color = generateConsistentIndices(msg.r);
  
  let hidden = false;
  let time = '';

  // Function to refresh the time
  const refresh = () => {
    const now = new Date();
    const diff = now.getTime() - new Date(msg.timestamp ?? 0).getTime();
    time = prettyMilliseconds(diff, { compact: true });
  };
  const refreshInterval = setInterval(refresh, 10000);

  onMount(() => {
    const timestamp = new Date(msg.timestamp ?? 0);
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    time = prettyMilliseconds(diff, { compact: true });
    return () => clearInterval(refreshInterval);
  });
</script>

<div
  class="bg-base-100 relative flex w-full flex-row justify-between border border-light-500 px-2 py-3.5 font-light dark:border-dark-400"
>
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <span
    class=" absolute -left-2 -top-4 aspect-square
    border border-light-300 p-1
    px-2 text-sm dark:border-dark-500"
    style="background: {color};"
    on:click={() => (hidden = !hidden)}
  >
    &nbsp;
  </span>
  <span
    class="border-black absolute -top-4 left-1
    border border-light-300 bg-dark-content
    p-1 px-2 text-sm dark:border-dark-500 dark:bg-light-content"
  >
    {msg.r}
  </span>
  {#if !hidden}
    {#if msg.image && msg.image.id && msg.image.blurhash}
      <span
        class="border-black absolute -top-4 left-28 h-7 w-7
        border border-light-300 bg-dark-content
        text-sm dark:border-dark-500 dark:bg-light-content"
      >
        <BlurhashThumbnail imageId={msg.image.id} />
      </span>
    {/if}
  {/if}

  <span>
    {msg.msg}
  </span>
  <div class="absolute bottom-2 right-2 flex flex-row items-center justify-center">
    <span class="text-xs">{time}</span>
  </div>
</div>
