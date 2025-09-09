<script lang="ts">
  import { onMount } from 'svelte';
  import X from 'phosphor-svelte/lib/X';
  import * as Dialog from '$lib/components/ui/dialog';

  interface Props {
    imageId?: string;
  }

  let { imageId = '' }: Props = $props();
  let imageBase64 = $state('');

  const fetchFullImage = async (open: boolean) => {
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
    fetchFullImage(true);
  });
</script>

<Dialog.Root onOpenChange={fetchFullImage}>
  <Dialog.Trigger
    class="inline-flex items-center justify-center whitespace-nowrap transition-colors active:scale-98 "
  >
    <img src={imageBase64} alt="." class=" aspect-square object-cover" />
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay
      class=" bg-light-200/50  text-light-700 dark:bg-dark-800/50 dark:text-dark-600 
      fixed inset-0 z-50
      border border-black
      
      "
    />
    <Dialog.Content>
      <div class=" flex flex-col items-center justify-center gap-12 p-4 text-xs">
        {#if imageBase64}
          <img src={imageBase64} alt="View..." />
        {:else}
          <div class="loader"></div>
        {/if}
      </div>

      <Dialog.Close
        class="bg-light-400 text-light-900 dark:bg-dark-900 dark:text-dark-200 
      absolute -top-8 -right-8 
      w-fit rounded-xs p-1 active:scale-98"
      >
        <X size="16" />
      </Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
