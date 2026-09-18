<script lang="ts">
  import HeaderRow from '$lib/components/HeaderRow.svelte';
  import type { IKeyPairs } from '$lib/types';

  import { onMount } from 'svelte';

  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';

  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import IdentityList from './IdentityList.svelte';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
  import IdentityChip from '$lib/components/IdentityChip.svelte';
  import { Button } from '$lib/components/ui/button';
  import UserPlus from 'phosphor-svelte/lib/UserPlus';
  import IdentityBackup from './IdentityBackup.svelte';
  import { loadRoomSummaries, type RoomSummary } from '$lib/utils/roomSummaries';

  let keyPairs: IKeyPairs[] = $state([]);
  let loadedPair: IKeyPairs | undefined = $state(undefined);
  let loading = $state(false);
  let summaries: Record<string, RoomSummary> = $state({});

  // One batch read for every identity in the browser, so the list can say
  // which rooms actually hold anything. Not awaited alongside the keypairs:
  // localStorage is instant and the network is not, and the rooms must be
  // listed either way.
  const refreshSummaries = async () => {
    summaries = await loadRoomSummaries(keyPairs.map((k) => k.uniqueString));
  };

  onMount(async () => {
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
    refreshSummaries();
  });
</script>

<div
  class="container mx-auto flex w-full max-w-4xl grow flex-col items-center justify-start"
>
  <HeaderRow variant="page">
    <a href="/" class="flex shrink-0 items-center justify-center" aria-label="Home">
      <CaretLeft weight="bold" size={24} />
    </a>
    <h1>Manage rooms &amp; identities</h1>
    {#snippet trailing()}
      {#if loadedPair}
        <span class="whitespace-nowrap">
          <IdentityChip rid={loadedPair.uniqueString} />
        </span>
      {/if}
      <Button
        class=" flex items-center justify-center gap-4 rounded-xs p-2 text-sm whitespace-nowrap"
        onclick={async () => {
          loading = true;
          try {
            const newPgp = await ResetPgpIdentity();
            if (!newPgp) {
              // Registration failed server-side (see ResetPgpIdentity) —
              // nothing to save. Previously this `return` skipped resetting
              // `loading`, leaving the button stuck spinning forever.
              console.error('Failed to create a new identity. See network tab for details.');
              return;
            }

            saveToLS(
              newPgp.privateKey,
              newPgp.publicKey,
              newPgp.revocationCertificate,
              newPgp.uniqueString
            );

            keyPairs = await getAllFromLS();
            refreshSummaries();
          } finally {
            loading = false;
          }
        }}
      >
        {#if loading}
          <Spinner class="animate-spin" />
        {:else}
          <UserPlus />
        {/if}
        New Identity
      </Button>
    {/snippet}
  </HeaderRow>

  <!-- One band of cells, like the nav and the attach row: no padding on the
       row, no gaps, each control carrying its own padding and a divider, and
       left-aligned because that is where every other row on the site starts.
       border-b only. HeaderRow above already draws a bottom rule, so adding a
       top one here stacked 2px of hairline against it; the grid below draws
       only right and bottom rules on its cells, so this row has to close
       itself off underneath. -->
  <div class="border-border flex w-full flex-row flex-wrap items-stretch border-b">
    <IdentityBackup onImported={async () => {
      keyPairs = await getAllFromLS();
      refreshSummaries();
    }} />
  </div>

  <IdentityList bind:loadedPair bind:keyPairs {summaries} />
</div>
