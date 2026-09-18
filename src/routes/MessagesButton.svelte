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

  <!-- The chip hangs off the button's bottom edge like a tab, and both parts
       of that are corrections. It used to be anchored at right-12, but the
       tab variant's swatch and label are absolutely positioned off a
       zero-width anchor and extend to the RIGHT of it, so a right-side anchor
       pushed the chip most of its own width past the button. And the anchor
       needs `flex`: without it the chip's own `relative inline-block` box is
       an inline on a line box, so it lands on that line's baseline, 18px
       below where it was placed. That silently ate the chip's -top-4 and left
       it floating 2px under the button, reading as a collision rather than a
       label. `flex` removes the baseline drop; translate-y-4 then cancels the
       -top-4 on purpose, so the chip sits flush beneath the edge instead of
       straddling it. The straddle is right on an inbox card, where chip and
       card are the same muted surface. Here it would drop a dark block across
       a filled button and over its label. -->
  <span
    in:scale={{ start: 1.02, duration: 800, easing: quintInOut }}
    class="absolute top-full left-4 flex translate-y-4"
  >
    <IdentityChip rid={loadedPair.uniqueString} variant="tab" />
  </span>
</div>
