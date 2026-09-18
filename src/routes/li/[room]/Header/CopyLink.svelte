<script lang="ts">
  import { page } from '$app/state';
  import { scale } from 'svelte/transition';
  import { Button } from '$lib/components/ui/button';

  import CheckFat from 'phosphor-svelte/lib/CheckFat';
  import ShareNetwork from 'phosphor-svelte/lib/ShareNetwork';

  let copied = $state(false);

  let rid = page.params.room;

  async function copyLink() {
    await navigator.clipboard.writeText(page.url.origin + '/b/' + rid);
    copied = true;
    setTimeout(() => (copied = false), 2000);
  }
</script>

<!-- h-full, not h-auto: this sits beside two size-18 (72px) squares, and its
     p-4 made it 56px, so the row of three came out uneven. -->
<Button onclick={copyLink} class="h-full w-full rounded-none p-0">
  <span class="flex h-full w-full items-center justify-center p-4">
    {#if copied}
      <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
        <span>
          <CheckFat size={20} weight="duotone" />
        </span>
        <span class="text-xs whitespace-nowrap md:text-sm">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {:else}
      <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
        <span>
          <ShareNetwork size={20} weight="duotone" />
        </span>
        <span class="text-xs whitespace-nowrap md:text-sm">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {/if}
  </span>
</Button>
