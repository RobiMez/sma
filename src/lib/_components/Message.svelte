<script lang="ts">
  export let msg: any;
  export let color: any;
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import ImageThumbnail from './ImageThumbnail.svelte';
  import { decode } from 'blurhash';
  import BlurhashThumbnail from './BlurhashThumbnail.svelte';

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

<div class="relative w-full border border-black bg-base-100 px-2 py-3.5 font-light">
  {#if !hidden}
    <div class="w-full overflow-hidden">
      {#if msg.image && msg.image.id && msg.image.blurhash}
        <BlurhashThumbnail blurhash={msg.image.blurhash} imageId={msg.image.id} />
      {/if}
      {msg.msg}
    </div>
  {/if}

  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <span
    class="absolute -left-2 -top-4 aspect-square border border-black p-1 px-2 text-xs"
    style="background: {color};"
    on:click={() => (hidden = !hidden)}
  >
    &nbsp;
  </span>
  <span class="absolute -top-4 left-1 border border-black bg-base-100 p-1 px-2 text-xs">
    {msg.r}
  </span>
  <span class="absolute bottom-1 right-2 text-xs">{time}</span>
</div>
