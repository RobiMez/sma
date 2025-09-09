<script lang="ts">
  import { fade, scale } from 'svelte/transition';

  import IdentityPill from './IdentityPill.svelte';

  import * as Dialog from '$lib/components/ui/dialog';
  import { getAllFromLS, getLoadedPairFromLS, loadPair } from '$lib/utils/localStorage';

  import type { IKeyPairs } from '$lib/types';
  import { Button } from '$lib/components/ui/button';

  import UserCheck from 'phosphor-svelte/lib/UserCheck';
  import UserSwitch from 'phosphor-svelte/lib/UserSwitch';
  import { generateConsistentIndices } from '$lib/utils/colors';

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

  const handleLoadPairUpdate = (
    newLoadedPair: IKeyPairs | undefined,
    newKeyPairs: IKeyPairs[] | undefined
  ) => {
    loadedPair = newLoadedPair;
    keyPairs = newKeyPairs ?? [];
  };

  const handleLoadIdentity = async () => {
    loadPair(selectedIdentity?.uniqueString ?? '');
    const newLoadedPair = await getLoadedPairFromLS();
    const newKeyPairs = await getAllFromLS();
    handleLoadPairUpdate(newLoadedPair, newKeyPairs);
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

<Dialog.Root bind:open={isOpen}>
  <Dialog.Content class="sm:max-w-[80vw]">
    {#if selectedIdentity}
      <Dialog.Header>
        <Dialog.Title>Identity</Dialog.Title>
        <Dialog.Description class="flex flex-row items-center justify-between">
          Load a new identity here, below is the details of the identity.
          <span class="inline-flex w-fit items-center justify-center border whitespace-nowrap">
            <span class="relative flex flex-row items-center justify-center rounded-xs">
              {#if selectedIdentity.uniqueString}
                {@const color = generateConsistentIndices(selectedIdentity.uniqueString)}
                <span class="flex flex-row items-center justify-center gap-2">
                  <div
                    class="inline-block aspect-square h-8 w-8 text-sm"
                    style="background: {color};"
                  >
                    &nbsp;
                  </div>
                  <span class="w-32 px-2 pr-1 text-left text-sm whitespace-nowrap">
                    {selectedIdentity.uniqueString}
                  </span>
                </span>
              {/if}
            </span>
          </span>
        </Dialog.Description>
      </Dialog.Header>

      <span class="flex flex-col gap-4 px-4 py-12 text-sm">
        <small class="font-light">
          {selectedIdentity.pbKey}
        </small>
        <small class="font-light">
          {selectedIdentity.prKey}
        </small>
        <small class="font-light">
          {selectedIdentity.RC}
        </small>
      </span>

      <Dialog.Footer>
        <Button
          class="button w-fit rounded-xs border border-[#00000000] p-2 text-sm whitespace-nowrap transition-all
      {loadedPair?.uniqueString !== selectedIdentity.uniqueString
            ? 'hover:border-light-900 dark:hover:border-dark-100'
            : ''}
      "
          disabled={loadedPair?.uniqueString == selectedIdentity.uniqueString}
          onclick={handleLoadIdentity}
        >
          {#if loadedPair?.uniqueString == selectedIdentity.uniqueString}
            <span class="flex items-center justify-center gap-2 whitespace-nowrap">
              <UserCheck size={24} />
              Loaded Identity
            </span>
          {:else}
            <span class="flex items-center justify-center gap-2 whitespace-nowrap">
              <UserSwitch size={24} />
              Load Identity
            </span>
          {/if}
        </Button>
      </Dialog.Footer>
    {/if}
  </Dialog.Content>
</Dialog.Root>
