<script lang="ts">
  import type { IKeyPairs } from '$lib/types';
  import { Button } from '$lib/components/ui/button';
  import IdentityChip from '$lib/components/IdentityChip.svelte';
  import Mailbox from 'phosphor-svelte/lib/Mailbox';
  import { scale } from 'svelte/transition';
  import { quintInOut } from 'svelte/easing';

  interface Props {
    loadedPair: IKeyPairs;
  }

  let { loadedPair }: Props = $props();
</script>

<div class="relative">
  <Button href="/li/{loadedPair?.uniqueString}" size="lg" class="text-md">
    <Mailbox class="size-5" weight="duotone" />
    Your Messages
  </Button>

  <!-- Anchored at the button's bottom-LEFT, not right-12: the tab variant's
       parts are absolutely positioned off a zero-width anchor and extend to
       the RIGHT of it, so a right-side anchor made the whole chip jut past
       the button's edge by most of its own width. From the left corner the
       chip lies along the bottom edge and stays inside the button's
       footprint, which is what makes it read as a tag on the button rather
       than a collision. top-full (plus the chip's own -top-4) keeps exactly
       the straddle the inbox cards use. -->
  <span
    in:scale={{ start: 1.02, duration: 800, easing: quintInOut }}
    class="absolute top-full left-4"
  >
    <IdentityChip rid={loadedPair.uniqueString} variant="tab" />
  </span>
</div>
