<script lang="ts">
  import { onMount } from 'svelte';
  import { scale } from 'svelte/transition';
  import { expoInOut } from 'svelte/easing';

  import { getAllFromLS, getLoadedPairFromLS } from '$lib/utils/localStorage';

  import Stats from '$lib/_components/Landing/Stats.svelte';
  import IdentitiesButton from '$lib/_components/Landing/IdentitiesButton.svelte';
  import MessagesButton from '$lib/_components/Landing/MessagesButton.svelte';
  import PGPPowerUser from '$lib/_components/Landing/PGPPowerUser.svelte';

  import type { LoadedPair, IKeyPairs } from '$lib/types';

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: LoadedPair | null = $state(null);

  let powerUser: boolean = false;

  onMount(async () => {
    // These make sure that the creds are set internally
    keyPairs = await getAllFromLS();
    loadedPair = (await getLoadedPairFromLS()) ?? null;
  });
</script>

<div
  class="container mx-auto flex max-h-fit min-h-screen max-w-2xl flex-grow flex-col items-center justify-center gap-8 p-8"
>
  <span class="flex flex-col items-center justify-center gap-2">
    <h1
      class="relative text-xl font-extralight transition-all sm:text-2xl
			md:text-3xl lg:text-4xl"
    >
      Welcome to S.M.A
    </h1>

    <h6 class="text-md font-extralight md:text-lg lg:text-xl">Send Messages Anon</h6>
    <Stats />
  </span>

  {#if loadedPair}
    <div
      class="flex flex-row items-center justify-center gap-4"
      transition:scale={{ easing: expoInOut, duration: 500, start: 0.99 }}
    >
      <IdentitiesButton />
      <MessagesButton {loadedPair} />
    </div>
    <PGPPowerUser {powerUser} {loadedPair} />
  {/if}

  <footer class="bg-base-100 text-primary fixed bottom-0 z-50">
    <span class="p-1 text-sm font-extralight"
      >A <a class="underline" href="https://robi.work">robi.work</a> site
    </span>
  </footer>
</div>
