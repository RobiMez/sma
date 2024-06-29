<script lang="ts">
  import * as openpgp from 'openpgp';
  import DOMPurify from 'dompurify';
  import { onMount } from 'svelte';
  import { fade, slide } from 'svelte/transition';
  import packageJson from '../../package.json';
  import content from '../../CHANGELOG.md';
  import { marked } from 'marked';
  import { browser } from '$app/environment';
  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import { getAllFromLS, getLoadedPairFromLS, saveToLS } from '$lib/utils/localStorage';
  import { generateConsistentIndices } from '$lib/utils/colors';

  interface Stats {
    activeUsers: number;
    identities: number;
    totalMessages: number;
  }

  let keyPairs:
    | {
        prKey: string;
        pbKey: string;
        RC: string;
        uniqueString: string;
      }[]
    | undefined;

  let loadedPair: {
    prKey: string;
    pbKey: string;
    RC: string;
    uniqueString: string;
  } | null = null;

  let stats: Stats;
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

    const response = await fetch(`/api/stats`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    const resp = await response.json();

    if (resp.error) {
      stats = { activeUsers: -1, identities: -1, totalMessages: -1 };
      console.log(resp.message);
    } else {
      stats = resp.body;
      console.log(resp.message);
    }
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
      {#if browser}
        <button
          class="absolute -bottom-6 -right-6 cursor-pointer rounded-sm bg-light-200 p-1
					px-2 text-xs text-light-900 md:text-sm lg:text-base dark:bg-dark-800 dark:text-dark-200
        "
          on:click={() => {
            localStorage.setItem('LastReadChangelog', packageJson.version);
            newChangelog = false;
            displayChangelog = !displayChangelog;
          }}
        >
          V{packageJson.version}
          {!newChangelog ? '' : ' ✨ '}
        </button>
      {/if}
    </h1>

    <h6 class="text-md font-extralight md:text-lg lg:text-xl">Send Messages Anon</h6>
    {#if stats}
      <small in:fade class="text-primary/80 text-sm font-normal">
        <b>{stats.activeUsers ?? ''}</b> Active user{stats.activeUsers != 1 ? 's' : ''} ,
        <b>{stats.identities}</b>
        {stats.identities != 1 ? 'Identities' : 'Identity'} ,
        <b>{stats.totalMessages}</b> Msg{stats.totalMessages != 1 ? 's' : ''} and counting...
      </small>
    {:else}
      <small class="text-primary text-sm font-light"> Loading Stats... </small>
    {/if}
  </span>
  {#if displayChangelog}
    <div transition:slide class="changelog max-w-lg">
      {@html changelog}
    </div>
  {/if}

  {#if loadedPair}
    <div class="flex flex-row items-center justify-center gap-4">
      <a href="/i" class="whitespace-nowrap rounded-sm border p-5"> Identities </a>
      <div class="relative">
        <a class="whitespace-nowrap rounded-sm border p-5" href="/li/{loadedPair?.uniqueString}">
          Your Messages
        </a>
        <span
          class="absolute -bottom-8
      right-12 flex flex-row
      rounded-sm text-sm"
        >
          {#if loadedPair}
            {@const color = generateConsistentIndices(loadedPair.uniqueString)}
            <span
              class=" absolute -left-2 -top-4 aspect-square
          border border-light-300 p-1
          px-2 text-sm dark:border-dark-500"
              style="background: {color};"
            >
              &nbsp;
            </span>
            <span
              class="border-black absolute -top-4 left-1
          whitespace-nowrap border border-light-300 bg-dark-content
          p-1 px-2 text-sm dark:border-dark-500 dark:bg-light-content"
            >
              {loadedPair.uniqueString}
            </span>
          {/if}
        </span>
      </div>
    </div>
    <div class="flex flex-col items-center justify-center gap-4 pt-2">
      <button
        class="text-xs"
        on:click={() => {
          powerUser = !powerUser;
        }}
      >
        {powerUser ? 'Hide' : 'Show'}
        PGP tools</button
      >
      {#if powerUser}
        <div class="flex max-w-[80vw] flex-col gap-4 py-4 lg:flex-row" transition:slide>
          <div class="border-black relative border p-2">
            <small class="bg-primary text-primary-content absolute -top-3 z-40 rounded-sm px-1"
              >{loadedPair.prKey ? 'Private Key ( Super secret , dont share )' : ''}</small
            >
            <h1 class=" break-all text-xs blur-sm transition-all duration-1000 hover:blur-none">
              {loadedPair.prKey ?? ''}
            </h1>
          </div>

          <div class="border-black relative border p-2">
            <small class="bg-primary text-primary-content absolute -top-3 z-40 rounded-sm px-1"
              >{loadedPair.pbKey ? 'Public Key ( Share as you like ) ' : ''}</small
            >
            <h1 class=" break-all text-xs">{loadedPair.pbKey ?? ''}</h1>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <footer
    class="
	bg-base-100 text-primary fixed bottom-0 z-50 flex
	w-full items-center justify-center"
  >
    <span class="p-1 text-sm font-extralight"
      >A <a class="underline" href="https://robi.work">robi.work</a> site
    </span>
  </footer>
</div>
