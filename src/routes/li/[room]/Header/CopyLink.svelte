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

<!-- Fills the leftover width in the phone-width button row; in the desktop
     column it is stretched to the column's width instead. -->
<Button onclick={copyLink} aria-label="Copy room link" class="h-auto flex-1 p-0 sm:flex-none">
  <span class="flex items-center justify-center p-4">
    {#if copied}
      <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
        <span>
          <CheckFat size={20} weight="duotone" />
        </span>
        <span class="hidden text-xs whitespace-nowrap sm:flex md:text-sm">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {:else}
      <span in:scale={{ start: 0.9 }} class="flex items-center justify-center gap-2">
        <span>
          <ShareNetwork size={20} weight="duotone" />
        </span>
        <span class="hidden text-xs whitespace-nowrap sm:flex md:text-sm">
          {copied ? 'Copied!' : 'Copy link'}
        </span>
      </span>
    {/if}
  </span>
</Button>
