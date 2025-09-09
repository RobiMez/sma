<script lang="ts">
  import type { IKeyPairs } from '$lib/types';
  import { generateConsistentIndices } from '$lib/utils/colors';
  import { Button } from '$lib/components/ui/button';
  import Mailbox from 'phosphor-svelte/lib/Mailbox';
  import { fly, scale } from 'svelte/transition';
  import { quintInOut } from 'svelte/easing';

  interface Props {
    loadedPair: IKeyPairs;
  }

  let { loadedPair }: Props = $props();
  const color = $derived(generateConsistentIndices(loadedPair.uniqueString));
</script>

<div class="relative">
  <Button href="/li/{loadedPair?.uniqueString}" size="lg" class="text-md">
    <Mailbox class="size-5" weight="duotone" />
    Your Messages
  </Button>

  <span
    in:scale={{ start: 1.02, duration: 800, easing: quintInOut }}
    class="
        absolute right-12
        -bottom-2
        flex flex-row
        rounded-xs text-sm"
  >
    <span
      class=" border-primary absolute -top-4
        -left-2 aspect-square border
        p-1 px-2 text-sm"
      style="background: {color};"
    >
      &nbsp;
    </span>
    <span
      class="border-primary bg-muted
        absolute -top-4 left-1 border
        border-black p-1 px-2 text-sm whitespace-nowrap"
    >
      {loadedPair.uniqueString}
    </span>
  </span>
</div>
