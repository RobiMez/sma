<script lang="ts">
  import type { LoadedPair } from '$lib/types';
  import { elasticInOut, expoInOut, quadIn, quintInOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import XCircle from 'phosphor-svelte/lib/XCircle';

  export let powerUser = false;
  export let loadedPair: LoadedPair;
</script>

<button
  class="text-xs underline"
  on:click={() => {
    powerUser = !powerUser;
  }}
>
  {powerUser ? 'Hide' : 'Show'}
  PGP tools</button
>
{#if powerUser}
  <div class="modal" transition:slide={{ easing: expoInOut, duration: 1000 }}>
    <button on:click={() => (powerUser = false)}>
      <XCircle size={24} />
    </button>
    <div class="border-black relative border p-2">
      <small class="keydisplayHeader">Private Key</small>
      <h1 class="keyDisplayBlur">
        {loadedPair.prKey ?? ''}
      </h1>
    </div>

    <div class="border-black relative border p-2">
      <small class="keydisplayHeader">Public Key</small>
      <h1 class="keyDisplay">{loadedPair.pbKey ?? ''}</h1>
    </div>
  </div>
{/if}

<style lang="postcss">
  .modal {
    @apply absolute left-12 top-8 flex max-w-[80vw] flex-col gap-4  py-4 lg:flex-row;
  }

  .modal button {
    @apply absolute -right-6 top-0;
  }

  .keyDisplay {
    /* @apply bg-dark-content  text-dark-base dark:bg-dark-base dark:text-dark-content; */

    @apply break-all text-xs;
  }
  .keyDisplayBlur {
    @apply break-all text-xs blur-sm transition-all duration-1000 hover:blur-none;
  }

  .keydisplayHeader {
    @apply absolute -top-3 z-40 rounded-sm bg-dark-base px-1 text-dark-content dark:bg-dark-content dark:text-dark-base;
  }
</style>
