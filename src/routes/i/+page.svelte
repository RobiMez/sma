<script lang="ts">
  import type { IKeyPairs, LoadedPair } from '$lib/types';

  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';

  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import IdentityList from '$lib/_components/Identities/IdentityList.svelte';
  import Spinner from 'phosphor-svelte/lib/Spinner';

  let keyPairs: IKeyPairs[] = [];
  let loadedPair: LoadedPair | undefined = undefined;
  let loading = false;
  onMount(async () => {
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
  });
</script>

<div
  class="container mx-auto flex min-h-screen w-full max-w-4xl flex-grow flex-col items-center justify-start gap-4 p-2 pt-8"
>
  <div
    class="flex w-full flex-row items-center justify-between bg-light-200 pr-12 dark:bg-dark-800"
  >
    <h1 class="text-md md:text-md relative w-full p-4 text-left font-light lg:text-xl">
      Manage rooms & identities
    </h1>
    {#if loadedPair}
      <span class="px-4">
        {loadedPair?.uniqueString}
      </span>
    {/if}

    <span class=" rounded-sm p-1 font-extralight">
      <button
        class=" flex items-center justify-center gap-4 whitespace-nowrap rounded-sm bg-light-300 p-2 text-sm dark:bg-dark-900"
        on:click={async () => {
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
        {/if}
        New Identity
      </button>
    </span>
  </div>

  <div class=" flex w-full flex-row flex-wrap gap-4 p-4">
    <IdentityList bind:loadedPair bind:keyPairs />
  </div>
</div>
