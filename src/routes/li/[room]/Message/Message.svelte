<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import BlurhashThumbnail from './BlurhashThumbnail.svelte';

  interface Props {
    msg: any;
  }

  let { msg }: Props = $props();
  const color = generateConsistentIndices(msg.r);

  let time = $state('');

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

<div class="border-primary relative flex w-full flex-row justify-between border p-4 bg-muted">
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <span class="absolute -top-1 -left-[5px] flex flex-row text-sm">
    <span
      class=" border-primary absolute -top-4
  -left-2 aspect-square border
  p-1 px-2 text-sm"
      style="background: {color};"
    >
      &nbsp;
    </span>
    <span
      class="border-primary bg-background absolute -top-4 left-1 border border-black p-1 px-2 text-sm whitespace-nowrap"
    >
      {msg.r}
    </span>
  </span>

  {#if msg.image && msg.image.id && msg.image.blurhash}
    <span class="border-primary absolute -top-5 left-28 h-7 w-7 border text-sm">
      <BlurhashThumbnail imageId={msg.image.id} />
    </span>
  {/if}

  <span class="w-full">
    {msg.msg}
  </span>
  <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center">
    <span class="text-xs">{time}</span>
  </div>
</div>
