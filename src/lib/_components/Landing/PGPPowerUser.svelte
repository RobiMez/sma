<script lang="ts">
  import type { IKeyPairs } from '$lib/types';
  import { expoInOut } from 'svelte/easing';
  import { slide } from 'svelte/transition';
  import XCircle from 'phosphor-svelte/lib/XCircle';

  interface Props {
    powerUser?: boolean;
    loadedPair: IKeyPairs;
  }

  let { powerUser = $bindable(false), loadedPair }: Props = $props();
</script>

<button
  class="text-xs underline"
  onclick={() => {
    powerUser = !powerUser;
  }}
>
  {powerUser ? 'Hide' : 'Show'}
  PGP tools</button
>
{#if powerUser}
  <div class="modal" transition:slide={{ easing: expoInOut, duration: 1000 }}>
    <button onclick={() => (powerUser = false)}>
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
    @apply break-all text-xs;
  }
  .keyDisplayBlur {
    @apply break-all text-xs blur-sm transition-all duration-1000 hover:blur-none;
  }

  .keydisplayHeader {
    @apply absolute -top-3 z-40 rounded-sm bg-dark-base px-1 text-dark-content dark:bg-dark-content dark:text-dark-base;
  }
</style>
