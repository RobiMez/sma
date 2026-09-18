<script lang="ts">
  import { fade } from 'svelte/transition';

  import IdentityPill from './IdentityPill.svelte';

  import * as Dialog from '$lib/components/ui/dialog';
  import {
    getAllFromLS,
    getLoadedPairFromLS,
    loadPair,
    removeFromLS
  } from '$lib/utils/localStorage';
  import { signedFetch } from '$lib/utils/signedRequest';

  import type { IKeyPairs } from '$lib/types';
  import type { RoomSummary } from '$lib/config/rooms';
  import { Button } from '$lib/components/ui/button';

  import UserCheck from 'phosphor-svelte/lib/UserCheck';
  import UserSwitch from 'phosphor-svelte/lib/UserSwitch';
  import Trash from 'phosphor-svelte/lib/Trash';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import { generateConsistentIndices } from '$lib/utils/colors';

  interface Props {
    loadedPair: IKeyPairs | undefined;
    keyPairs: IKeyPairs[];
    /** Keyed by rid; empty until the batch read lands, and after it fails. */
    summaries?: Record<string, RoomSummary>;
  }

  let { loadedPair = $bindable(), keyPairs = $bindable(), summaries = {} }: Props = $props();

  let isOpen = $state(false);
  let selectedIdentity: IKeyPairs | null = $state(null);
  // Two steps on purpose. This is the one irreversible thing in the app, and
  // the private key it destroys is the only proof of ownership that exists:
  // there is no password reset, because there was never a password.
  let confirming = $state(false);
  let deleting = $state(false);
  let deleteError = $state('');

  const handleOpenModal = (identity: IKeyPairs) => {
    selectedIdentity = identity;
    confirming = false;
    deleteError = '';
    isOpen = true;
  };

  const handleDelete = async () => {
    const target = selectedIdentity?.uniqueString;
    if (!target) return;
    deleting = true;
    deleteError = '';
    try {
      const resp = await signedFetch('/api/pgp', 'DELETE', target, 'identity:delete');
      // `{ status, body }` envelope, never `{ error }`.
      if (resp.status !== 200 && resp.status !== 410 && resp.status !== 404) {
        deleteError = typeof resp.body === 'string' ? resp.body : 'Could not delete that identity.';
        return;
      }
      // 410 and 404 mean the server has no room to delete: already gone, or
      // never registered (see ResetPgpIdentity). Dropping the key locally is
      // still the right outcome, and refusing would strand an identity that
      // cannot be used for anything.
      removeFromLS(target);
      const newKeyPairs = await getAllFromLS();
      const newLoadedPair = await getLoadedPairFromLS();
      handleLoadPairUpdate(newLoadedPair, newKeyPairs);
      isOpen = false;
    } catch (e) {
      console.error('Failed to delete identity', e);
      deleteError = 'Could not delete that identity.';
    } finally {
      deleting = false;
      confirming = false;
    }
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

<!-- Brutalist grid, same construction as the style shop: the container draws
     the left rule, each cell draws its own right and bottom, so neighbours
     share one hairline instead of each carrying a box in a gap-4 field.

     fade rather than the scale it used to pop in with: scaling a cell scales
     its borders too, and a grid whose hairlines grow into place is a grid that
     looks broken for 150ms. -->
<div class="border-border grid w-full grid-cols-1 border-l sm:grid-cols-2 lg:grid-cols-3">
  {#each keyPairs as identity, i (identity.uniqueString)}
    <div
      transition:fade={{ delay: 40 * i, duration: 150 }}
      class="border-border border-r border-b"
    >
      <IdentityPill
        {identity}
        {loadedPair}
        summary={summaries[identity.uniqueString]}
        onClick={handleOpenModal}
      />
    </div>
  {/each}
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

      <Dialog.Footer class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <!-- Kept on the opposite side from Load, and spelled out rather than
             confirmed with a bare "are you sure": what goes and what stays
             are different questions, and the second one is the surprising
             half. -->
        <span class="flex flex-col gap-2">
          {#if confirming}
            <span class="text-sm">
              Delete this identity? Its room and every message in it are removed from the server
              and the key is dropped from this browser. Messages you sent to other people's rooms
              stay where they are. There is no way back: the key is the only proof this room was
              ever yours.
            </span>
            <span class="flex flex-row gap-2">
              <Button
                variant="destructive"
                class="rounded-xs p-2 text-sm"
                disabled={deleting}
                onclick={handleDelete}
              >
                {#if deleting}
                  <Spinner class="animate-spin" size={16} />
                {/if}
                Delete permanently
              </Button>
              <Button
                variant="outline"
                class="rounded-xs p-2 text-sm"
                disabled={deleting}
                onclick={() => (confirming = false)}
              >
                Keep it
              </Button>
            </span>
          {:else}
            <Button
              variant="outline"
              class="text-destructive w-fit rounded-xs p-2 text-sm"
              onclick={() => (confirming = true)}
            >
              <Trash size={16} />
              Delete identity
            </Button>
          {/if}
          {#if deleteError}
            <span class="text-destructive text-sm">{deleteError}</span>
          {/if}
        </span>

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
