<script lang="ts">
  import type { IKeyPairs, LoadedPair } from '$lib/types';

  import { onMount } from 'svelte';

  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';

  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import IdentityList from '$lib/_components/Identities/IdentityList.svelte';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import CaretLeft from 'phosphor-svelte/lib/CaretLeft';

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
    class="flex w-full flex-row items-center justify-between bg-light-200 pr-12 dark:bg-dark-800 px-2"
  >
    <span class="rounded-sm p-1 font-extralight">
      <a href="/" class="flex items-center justify-center ">
        <CaretLeft weight="bold" size={32} />
      </a>
    </span>
    <h1 class="text-md md:text-md relative w-full py-4 px-2 text-left font-light lg:text-xl">
      Manage rooms & identities
    </h1>
    {#if loadedPair}
      <span class="px-4">
        {loadedPair?.uniqueString}
      </span>
    {/if}

    <span class=" rounded-sm p-1 font-extralight">
      <button
        class="button flex items-center justify-center gap-4 whitespace-nowrap rounded-sm p-2 text-sm"
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

<style lang="postcss">
  .button {
    @apply bg-dark-600 px-4 py-2 text-light-100 dark:bg-dark-content dark:text-dark-900;
  }
  .button:hover {
    @apply bg-dark-800 dark:bg-dark-100;
  }
</style>
