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

  <span
    in:scale={{ start: 1.02, duration: 800, easing: quintInOut }}
    class="absolute right-12 -bottom-2"
  >
    <IdentityChip rid={loadedPair.uniqueString} variant="tab" />
  </span>
</div>
