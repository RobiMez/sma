<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    getAllFromLS,
    getFromLS,
    getLoadedPairFromLS,
    loadPair,
    saveToLS
  } from '$lib/utils/localStorage';
  import { generateConsistentIndices } from '$lib/utils/colors';
  import { Dialog } from 'bits-ui';
  import X from 'phosphor-svelte/lib/X';
  import { fade } from 'svelte/transition';
  import { ResetPgpIdentity } from '$lib/utils/pgp';
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

  onMount(async () => {
    keyPairs = await getAllFromLS();
    loadedPair = await getLoadedPairFromLS();
  });

  const ocf = async (open: boolean) => {
    if (open) {
      // Load how many messages are in the selected room
    }
  };
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
        class=" whitespace-nowrap rounded-sm bg-light-300 p-2 text-sm dark:bg-dark-900"
        on:click={async () => {
          const newPgp = await ResetPgpIdentity();
          if (!newPgp) return;

          saveToLS(
            newPgp?.privateKey,
            newPgp?.publicKey,
            newPgp?.revocationCertificate,
            newPgp?.uniqueString
          );

          keyPairs = await getAllFromLS();
        }}
      >
        New Identity
      </button>
    </span>
  </div>

  {#if browser && keyPairs}
    <div class="  flex w-full flex-row flex-wrap gap-4 p-4">
      {#each keyPairs as identity}
        <span class="inline-flex">
          <Dialog.Root onOpenChange={ocf}>
            <Dialog.Trigger
              class="active:scale-98 inline-flex items-center justify-center whitespace-nowrap border-2  transition-colors
              {loadedPair?.uniqueString === identity.uniqueString
                ? ' border-light-800 dark:border-dark-100'
                : 'border-[#00000000]'}
              "
            >
              <span
                class="relative flex flex-row items-center justify-center rounded-sm border border-light-400 dark:border-dark-300"
              >
                {#if identity.uniqueString}
                  {@const color = generateConsistentIndices(identity.uniqueString)}

                  <span class=" flex flex-row items-center justify-center gap-2">
                    <div
                      class="inline-block aspect-square h-8 w-8 text-sm"
                      style="background: {color};"
                    >
                      &nbsp;
                    </div>
                    <span class="w-32 whitespace-nowrap px-2 pr-1 text-left text-sm">
                      {identity.uniqueString}
                    </span>
                  </span>
                {/if}
              </span>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay
                transition={fade}
                transitionConfig={{ duration: 150 }}
                class=" border-black  fixed inset-0 z-50 
          border bg-light-200/50 text-light-700
          dark:bg-dark-800/50 dark:text-dark-600
          
          "
              />
              <Dialog.Content
                class="  fixed left-[50%] top-[50%] z-50  w-fit max-w-[94%] translate-x-[-50%] translate-y-[-50%]
          border border-dark-800
          bg-light-100 text-light-700
          outline-none sm:max-w-[490px] lg:max-w-[60vw] 
          dark:border-dark-200 dark:bg-dark-800
          dark:text-dark-200  "
              >
                <span class="flex flex-col gap-4 px-4 py-12 text-sm">
                  <span class="w-32 whitespace-nowrap px-2 pr-1 text-left text-sm">
                    {identity.uniqueString}
                  </span>
                  <small class="  font-light">
                    {identity.pbKey}
                  </small>
                  <small class="  font-light">
                    {identity.prKey}
                  </small>
                  <small class="  font-light">
                    {identity.RC}
                  </small>

                  <button
                    class=" whitespace-nowrap rounded-sm bg-light-300 p-2 text-sm dark:bg-dark-900"
                    on:click={async () => {
                      loadPair(identity.uniqueString);
                      loadedPair = await getLoadedPairFromLS();
                      keyPairs = await getAllFromLS();
                    }}
                  >
                    {#if loadedPair?.uniqueString == identity.uniqueString}
                      loaded
                    {:else}
                      load
                    {/if}
                    Identity
                  </button>
                </span>

                <Dialog.Close
                  class="active:scale-98 absolute right-2 top-2 
          w-fit rounded-sm bg-light-400 
          p-1 text-light-900 
          
          dark:bg-dark-900 dark:text-dark-200"
                >
                  <X size="16" />
                </Dialog.Close>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </span>
      {/each}
    </div>
  {/if}
</div>
