<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';

  import type { IKeyPairs, LoadedPair } from '$lib/types';
  import { getAllFromLS, getLoadedPairFromLS, loadPair, saveToLS } from '$lib/utils/localStorage';
  import { ResetPgpIdentity } from '$lib/utils/pgp';
  import { generateConsistentIndices } from '$lib/utils/colors';

  import IdentificationCard from 'phosphor-svelte/lib/IdentificationCard';
  import UserSwitch from 'phosphor-svelte/lib/UserSwitch';
  import UserCheck from 'phosphor-svelte/lib/UserCheck';
  import Plus from 'phosphor-svelte/lib/Plus';
  import X from 'phosphor-svelte/lib/X';
  import Spinner from 'phosphor-svelte/lib/Spinner';

  export let loadedPair: LoadedPair | undefined;
  export let onIdentityChange: (newLoadedPair: LoadedPair | undefined) => void;

  let showModal = false;
  let keyPairs: IKeyPairs[] = [];
  let loading = false;

  const handleLoadIdentity = async (identity: IKeyPairs) => {
    loadPair(identity.uniqueString);
    const newLoadedPair = await getLoadedPairFromLS();
    loadedPair = newLoadedPair;
    onIdentityChange(newLoadedPair);
    showModal = false;
    // Navigate to the new identity's room
    window.location.href = `/li/${identity.uniqueString}`;
  };

  const handleCreateNewIdentity = async () => {
    loading = true;
    const newPgp = await ResetPgpIdentity();
    if (!newPgp) {
      loading = false;
      return;
    }

    saveToLS(
      newPgp?.privateKey,
      newPgp?.publicKey,
      newPgp?.revocationCertificate,
      newPgp?.uniqueString
    );

    keyPairs = await getAllFromLS();
    loading = false;
  };

  onMount(async () => {
    keyPairs = await getAllFromLS();
  });
</script>

<button
  on:click={() => (showModal = true)}
  class="min-w-18 max-w-18 flex flex-col items-center justify-center overflow-clip rounded-sm bg-light-200 p-1 dark:bg-dark-900 dark:text-dark-200"
  title="Switch Identity"
>
  <IdentificationCard size={18} weight="duotone" />
  <span class="bottom-1 whitespace-nowrap text-xs md:text-sm lg:flex">Identities</span>
</button>

{#if showModal}
  <div
    role="button"
    tabindex="0"
    transition:fade={{ duration: 150 }}
    class="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-light-200/50 text-light-700 dark:bg-dark-800/50 dark:text-dark-600"
    on:click={() => (showModal = false)}
    on:keydown={() => (showModal = false)}
    on:focus={() => (showModal = false)}
  >
    <div
      role="button"
      tabindex="0"
      class="fixed left-[50%] top-[50%] z-50 w-fit max-w-[94%] translate-x-[-50%] translate-y-[-50%] cursor-default border border-dark-800 bg-light-100 text-light-700 outline-none sm:max-w-[490px] lg:max-w-[60vw] dark:border-dark-200 dark:bg-dark-800 dark:text-dark-200"
      on:click|stopPropagation={() => {}}
      on:keydown|stopPropagation={() => {}}
      on:focus|stopPropagation={() => {}}
    >
      <div class="flex flex-col gap-4 px-4 py-6">
        <div class="flex items-center justify-between">
          <h3 class="text-lg font-light">Switch Identity</h3>
          <button class="button w-fit rounded-sm" on:click={() => (showModal = false)}>
            <X size="16" />
          </button>
        </div>

        <div class="flex max-h-64 flex-col gap-2 overflow-y-auto">
          {#each keyPairs as identity, i}
            {#if identity.uniqueString}
              {@const color = generateConsistentIndices(identity.uniqueString)}
              <div
                transition:scale={{ delay: 50 * i, start: 0.95 }}
                class="flex items-center justify-between border border-light-400 p-3 dark:border-dark-600"
              >
                <div class="flex items-center gap-3">
                  <div class="aspect-square h-6 w-6" style="background: {color};"></div>
                  <span class="font-mono text-sm">{identity.uniqueString}</span>
                </div>

                <button
                  class="button px-2 py-1 text-xs {loadedPair?.uniqueString ===
                  identity.uniqueString
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:border-light-900 dark:hover:border-dark-100'}"
                  disabled={loadedPair?.uniqueString === identity.uniqueString}
                  on:click={() => handleLoadIdentity(identity)}
                >
                  {#if loadedPair?.uniqueString === identity.uniqueString}
                    <span class="flex items-center gap-1">
                      <UserCheck size={16} />
                      Current
                    </span>
                  {:else}
                    <span class="flex items-center gap-1">
                      <UserSwitch size={16} />
                      Load
                    </span>
                  {/if}
                </button>
              </div>
            {/if}
          {/each}
        </div>

        <div class="border-t border-light-400 pt-4 dark:border-dark-600">
          <button
            class="button flex w-full items-center justify-center gap-2 p-3 text-sm"
            on:click={handleCreateNewIdentity}
            disabled={loading}
          >
            {#if loading}
              <Spinner class="animate-spin" size={16} />
              Creating...
            {:else}
              <Plus size={16} />
              Create New Identity
            {/if}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .button {
    @apply bg-dark-600 px-3 py-2 text-light-100 dark:bg-dark-content dark:text-dark-900;
  }
  .button:hover:not(:disabled) {
    @apply bg-dark-800 dark:bg-dark-100;
  }
</style>
