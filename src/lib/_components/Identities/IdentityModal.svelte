<script lang="ts">
  import { fade } from 'svelte/transition';

  import type { IKeyPairs, LoadedPair } from '$lib/types';

  import { getAllFromLS, getLoadedPairFromLS, loadPair } from '$lib/utils/localStorage';
  import { generateConsistentIndices } from '$lib/utils/colors';

  import X from 'phosphor-svelte/lib/X';
  import UserCheck from 'phosphor-svelte/lib/UserCheck';
  import UserSwitch from 'phosphor-svelte/lib/UserSwitch';

  export let selectedIdentity: IKeyPairs;
  export let loadedPair: LoadedPair | undefined;
  export let onClose: () => void;
  export let onLoadPairUpdate: (
    newLoadedPair: LoadedPair | undefined,
    newKeyPairs: IKeyPairs[] | undefined
  ) => void;

  const handleLoadIdentity = async () => {
    loadPair(selectedIdentity.uniqueString);
    const newLoadedPair = await getLoadedPairFromLS();
    const newKeyPairs = await getAllFromLS();
    onLoadPairUpdate(newLoadedPair, newKeyPairs);
  };
</script>

<div
  role="button"
  tabindex="0"
  transition:fade={{ duration: 150 }}
  class="fixed inset-0 z-50 flex h-full w-full items-center justify-center bg-light-200/50 text-light-700 dark:bg-dark-800/50 dark:text-dark-600"
  on:click={onClose}
  on:keydown={onClose}
  on:focus={onClose}
>
  <div
    role="button"
    tabindex="0"
    class="fixed left-[50%] top-[50%] z-50 w-fit max-w-[94%] translate-x-[-50%] translate-y-[-50%] cursor-default border border-dark-800 bg-light-100 text-light-700 outline-none sm:max-w-[490px] lg:max-w-[60vw] dark:border-dark-200 dark:bg-dark-800 dark:text-dark-200"
    on:click|stopPropagation={() => {}}
    on:keydown|stopPropagation={() => {}}
    on:focus|stopPropagation={() => {}}
  >
    <span class="flex flex-col gap-4 px-4 py-12 text-sm">
      <span class="inline-flex w-fit items-center justify-center whitespace-nowrap border">
        <span class="relative flex flex-row items-center justify-center rounded-sm">
          {#if selectedIdentity.uniqueString}
            {@const color = generateConsistentIndices(selectedIdentity.uniqueString)}
            <span class="flex flex-row items-center justify-center gap-2">
              <div class="inline-block aspect-square h-8 w-8 text-sm" style="background: {color};">
                &nbsp;
              </div>
              <span class="w-32 whitespace-nowrap px-2 pr-1 text-left text-sm">
                {selectedIdentity.uniqueString}
              </span>
            </span>
          {/if}
        </span>
      </span>

      <small class="font-light">
        {selectedIdentity.pbKey}
      </small>
      <small class="font-light">
        {selectedIdentity.prKey}
      </small>
      <small class="font-light">
        {selectedIdentity.RC}
      </small>

      <button
        class="button w-fit whitespace-nowrap rounded-sm border border-[#00000000] p-2 text-sm transition-all
        {loadedPair?.uniqueString !== selectedIdentity.uniqueString
          ? 'hover:border-light-900 dark:hover:border-dark-100'
          : ''}
        "
        disabled={loadedPair?.uniqueString == selectedIdentity.uniqueString}
        on:click={handleLoadIdentity}
      >
        {#if loadedPair?.uniqueString == selectedIdentity.uniqueString}
          <span class="flex items-center justify-center gap-2 whitespace-nowrap">
            <UserCheck size={24} />
            Loaded Identity
          </span>
        {:else}
          <span class="flex items-center justify-center gap-2 whitespace-nowrap">
            <UserSwitch size={24} />
            Load Identity
          </span>
        {/if}
      </button>
    </span>

    <button class="button absolute right-2 top-2 w-fit rounded-sm" on:click={onClose}>
      <X size="16" />
    </button>
  </div>
</div>

<style lang="postcss">
  .button {
    @apply bg-dark-600 p-1 text-light-100 dark:bg-dark-content dark:text-dark-900;
  }
  .button:hover {
    @apply bg-dark-800 dark:bg-dark-100;
  }
</style>
