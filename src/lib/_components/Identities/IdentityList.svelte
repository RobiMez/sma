<script lang="ts">
  import { scale } from 'svelte/transition';

  import IdentityPill from './IdentityPill.svelte';
  import IdentityModal from './IdentityModal.svelte';

  import type { IKeyPairs } from '$lib/types';

  interface Props {
    loadedPair: IKeyPairs | undefined;
    keyPairs: IKeyPairs[];
  }

  let { loadedPair = $bindable(), keyPairs = $bindable() }: Props = $props();

  let isOpen = $state(false);
  let selectedIdentity: IKeyPairs | null = $state(null);

  const handleOpenModal = (identity: IKeyPairs) => {
    selectedIdentity = identity;
    isOpen = true;
  };

  const handleCloseModal = () => {
    isOpen = false;
    selectedIdentity = null;
  };

  const handleLoadPairUpdate = (
    newLoadedPair: IKeyPairs | undefined,
    newKeyPairs: IKeyPairs[] | undefined
  ) => {
    loadedPair = newLoadedPair;
    keyPairs = newKeyPairs ?? [];
  };
</script>

<div class=" flex w-full flex-col items-center justify-center">
  <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
    {#each keyPairs as identity, i}
      <div transition:scale={{ delay: 100 + 50 * i, start: 0.9 }} class="inline-flex">
        <IdentityPill {identity} {loadedPair} onClick={handleOpenModal} />
      </div>
    {/each}
  </div>
</div>
{#if isOpen && selectedIdentity}
  <IdentityModal
    {selectedIdentity}
    {loadedPair}
    onClose={handleCloseModal}
    onLoadPairUpdate={handleLoadPairUpdate}
  />
{/if}
