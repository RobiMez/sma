<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  import X from 'phosphor-svelte/lib/X';

  interface Props {
    imageId?: string;
  }

  let { imageId = '' }: Props = $props();
  let imageBase64 = $state('');

  const ocf = async (open: boolean) => {
    if (open) {
      // Fetch the image from the db
      const response = await fetch(`/api/images?id=${imageId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Parse the JSON response
      const resp = await response.json();

      // If there's an error in the response, log the message
      if (resp.error) {
        console.log(resp.message);
      } else {
        imageBase64 = resp.body.dataURI.join('');
      }
    }
  };
  onMount(() => {
    ocf(true);
  });
</script>

<Dialog.Root onOpenChange={ocf}>
  <Dialog.Trigger
    class="active:scale-98 
  inline-flex items-center justify-center whitespace-nowrap transition-colors "
  >
    <img src={imageBase64} alt="." class=" aspect-square object-cover" />
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
      <div class=" flex flex-col items-center justify-center gap-12 p-4 text-xs">
        {#if imageBase64}
          <img src={imageBase64} alt="View..." />
        {:else}
          <div class="loader"></div>
        {/if}
      </div>

      <Dialog.Close
        class="active:scale-98 absolute -right-8 -top-8 
      w-fit rounded-sm bg-light-400 
      p-1 p-1 text-light-900 
      
      dark:bg-dark-900 dark:text-dark-200"
      >
        <X size="16" />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
