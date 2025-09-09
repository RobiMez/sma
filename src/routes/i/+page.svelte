<script lang="ts">
  import type { IKeyPairs } from '$lib/types';

  import { onMount } from 'svelte';

  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';

  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import IdentityList from './IdentityList.svelte';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft';
  import IdentityPill from './IdentityPill.svelte';
  import { Button } from '$lib/components/ui/button';
  import UserPlus from 'phosphor-svelte/lib/UserPlus';

  let keyPairs: IKeyPairs[] = $state([]);
  let loadedPair: IKeyPairs | undefined = $state(undefined);
  let loading = $state(false);
  onMount(async () => {
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
  });
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl grow flex-col items-center justify-start gap-4 p-2 pt-8"
>
  <div
    class="bg-light-200 dark:bg-dark-800 flex w-full flex-row items-center justify-between px-2 pr-12"
  >
    <span class="rounded-xs p-1 font-extralight">
      <a href="/" class="flex items-center justify-center">
        <CaretLeft weight="bold" size={32} />
      </a>
    </span>
    <h1 class="text-md md:text-md relative w-full px-2 py-4 text-left font-light lg:text-xl">
      Manage rooms & identities
    </h1>
    {#if loadedPair}
      <span class="px-4 whitespace-nowrap">
        <IdentityPill identity={loadedPair} />
      </span>
    {/if}

    <span class=" rounded-xs p-1 font-extralight">
      <Button
        class=" flex items-center justify-center gap-4 rounded-xs p-2 text-sm whitespace-nowrap"
        onclick={async () => {
          loading = true;
          const newPgp = await ResetPgpIdentity();
          if (!newPgp) return;

          saveToLS(
            newPgp?.privateKey,
            newPgp?.publicKey,
            newPgp?.revocationCertificate,
            newPgp?.uniqueString
          );

          keyPairs = await getAllFromLS();
          loading = false;
        }}
      >
        {#if loading}
          <Spinner class="animate-spin" />
        {:else}
          <UserPlus />
        {/if}
        New Identity
      </Button>
    </span>
  </div>

  <div class=" flex w-full flex-row flex-wrap gap-4 p-4">
    <IdentityList bind:loadedPair bind:keyPairs />
  </div>
</div>
