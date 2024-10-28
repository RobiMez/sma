<script lang="ts">
  import DOMPurify from 'dompurify';
  import { onMount } from 'svelte';
  import { scale, slide } from 'svelte/transition';
  import { expoInOut } from 'svelte/easing';
  import { marked } from 'marked';

  import packageJson from '../../package.json';
  import content from '../../CHANGELOG.md';

  import * as openpgp from 'openpgp';
  import { browser } from '$app/environment';
  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';
  import { generateConsistentIndices } from '$lib/utils/colors';

  import Stats from '$lib/_components/Landing/Stats.svelte';
  import IdentitiesButton from '$lib/_components/Landing/IdentitiesButton.svelte';
  import MessagesButton from '$lib/_components/Landing/MessagesButton.svelte';
  import PGPPowerUser from '$lib/_components/Landing/PGPPowerUser.svelte';

  import type { LoadedPair, IKeyPairs } from '$lib/types';

  let keyPairs: IKeyPairs[] | undefined;
  let loadedPair: LoadedPair | null = null;

  let changelog = '';
  let powerUser: boolean = false;
  let displayChangelog: boolean = false;
  let newChangelog: boolean = false;

  onMount(async () => {
    changelog = await marked(content);
    changelog = DOMPurify.sanitize(changelog);

    if (localStorage.getItem('LastReadChangelog') === packageJson.version) {
      displayChangelog = false;
    } else {
      displayChangelog = true;
      newChangelog = true;
    }

    // These make sure that the creds are set internally
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
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

    <!-- {#if displayChangelog}
    <div transition:slide class="changelog max-w-lg">
      {@html changelog}
    </div>
  {/if} -->
    <!-- {#if browser && newChangelog}
      <button
        class="absolute -bottom-6 -right-6 cursor-pointer rounded-sm bg-light-200 p-1
      px-2 text-xs text-light-900 md:text-sm lg:text-base dark:bg-dark-800 dark:text-dark-200
    "
        on:click={() => {
          localStorage.setItem('lastReadChangelog', packageJson.version);
          newChangelog = false;
          displayChangelog = !displayChangelog;
        }}
      >
        V{packageJson.version}
        {!newChangelog ? '' : ' ✨ '}
      </button>
    {/if} -->
  {/if}

  <footer class="bg-base-100 text-primary f fixed bottom-0 z-50">
    <span class="p-1 text-sm font-extralight"
      >A <a class="underline" href="https://robi.work">robi.work</a> site
    </span>
  </footer>
</div>
