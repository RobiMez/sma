<script lang="ts">
  import { generateConsistentIndices } from '$lib/utils/colors';
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import BlurhashThumbnail from './BlurhashThumbnail.svelte';
  import { domToPng } from 'modern-screenshot';
  import FileArrowDown from 'phosphor-svelte/lib/FileArrowDown';
  import Copy from 'phosphor-svelte/lib/Copy';
  import Check from 'phosphor-svelte/lib/Check';
  import XCircle from 'phosphor-svelte/lib/XCircle';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button';
  interface Props {
    msg: any;
  }

  let { msg }: Props = $props();
  const color = generateConsistentIndices(msg.r);

  let time = $state('');
  let dialogOpen = $state(false);
  let copyState = $state<'idle' | 'copied' | 'error'>('idle');

  // Function to refresh the time
  const refresh = () => {
    const now = new Date();
    const diff = now.getTime() - new Date(msg.timestamp ?? 0).getTime();
    time = prettyMilliseconds(diff, { compact: true });
  };
  const refreshInterval = setInterval(refresh, 10000);
  let messageElement: HTMLDivElement | undefined = $state(undefined);

  const downloadImage = async () => {
    try {
      if (!messageElement) {
        console.error('No cardElement found');
        return;
      }

      // Use domToPng directly on the cardElement
      const dataUrl = await domToPng(messageElement, {
        backgroundColor: 'var(--background)',
        scale: 4 // Optional: Increase scale for higher resolution
      });

      // Create link and trigger download
      const link = document.createElement('a');
      link.download = `message-${msg.r}-${new Date().toISOString()}.png`;
      link.href = dataUrl;
      link.click();

      // Clean up link element (optional but good practice)
      link.remove();
    } catch (error) {
      console.error('Failed to download image using dom-to-png:', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      if (!messageElement) {
        console.error('No messageElement found');
        copyState = 'error';
        setTimeout(() => {
          copyState = 'idle';
        }, 2000);
        return;
      }

      // Use domToPng to convert the element to an image
      const dataUrl = await domToPng(messageElement, {
        backgroundColor: 'var(--background)',
        scale: 4
      });

      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();

      // Copy to clipboard using Clipboard API
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob
        })
      ]);

      copyState = 'copied';
      setTimeout(() => {
        copyState = 'idle';
      }, 2000);
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
      copyState = 'error';
      setTimeout(() => {
        copyState = 'idle';
      }, 2000);
    }
  };

  onMount(() => {
    const timestamp = new Date(msg.timestamp ?? 0);
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    time = prettyMilliseconds(diff, { compact: true });

    return () => clearInterval(refreshInterval);
  });
</script>

<div class=" group -m-2 flex w-full flex-row justify-between px-4 py-6 pr-3 pb-2" id="message">
  <div class="border-border bg-muted relative flex w-full flex-row justify-between border p-3">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <span class="absolute -top-1 -left-[5px] flex flex-row text-sm">
      <span
        class=" border-primary absolute -top-4
  -left-2 aspect-square border
  p-1 px-2 text-sm"
        style="background: {color};"
      >
        &nbsp;
      </span>
      <span
        class="border-primary bg-background absolute -top-4 left-1 border border-black p-1 px-2 text-sm whitespace-nowrap"
      >
        {msg.r}
      </span>
    </span>

    {#if msg.image && msg.image.id && msg.image.blurhash}
      <span class="border-primary absolute -top-5 left-28 h-7 w-7 border text-sm">
        <BlurhashThumbnail imageId={msg.image.id} />
      </span>
    {/if}

    <span class="w-full">
      {msg.msg}
    </span>
    <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center">
      <span class="text-xs">{time}</span>
    </div>
    <button
      class="border-primary bg-background absolute -top-5 right-4 flex h-7 w-7 items-center justify-center border text-sm opacity-0 transition-all group-hover:opacity-100"
      onclick={() => {
        dialogOpen = !dialogOpen;
      }}
    >
      <FileArrowDown size={20} />
    </button>
  </div>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Download image</Dialog.Title>
      <Dialog.Description class=" pt-4 ">
        <div class="m-auto aspect-square border border-black flex justify-center items-center" bind:this={messageElement}>
          <div
            class=" group m-auto flex w-full flex-row justify-between px-4 py-6 pr-3 pb-2"
            id="message"
          >
            <div
              class="border-primary bg-muted relative flex w-full flex-row justify-between border p-3"
            >
              <!-- svelte-ignore a11y_no_static_element_interactions -->
              <!-- svelte-ignore a11y_click_events_have_key_events -->
              <span class="absolute -top-1 -left-[5px] flex flex-row text-sm">
                <span
                  class=" border-primary absolute -top-4
  -left-2 aspect-square border
  p-1 px-2 text-sm"
                  style="background: {color};"
                >
                  &nbsp;
                </span>
                <span
                  class="border-primary bg-background absolute -top-4 left-1 border border-black p-1 px-2 text-sm whitespace-nowrap"
                >
                  {msg.r}
                </span>
              </span>

              {#if msg.image && msg.image.id && msg.image.blurhash}
                <span class="border-primary absolute -top-5 left-28 h-7 w-7 border text-sm">
                  <BlurhashThumbnail imageId={msg.image.id} />
                </span>
              {/if}

              <span class="w-full text-left">
                {msg.msg}
              </span>
              <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center">
                <span class="text-xs">{time}</span>
              </div>
            </div>
          </div>
        </div>
      </Dialog.Description>
    </Dialog.Header>
    <Dialog.Footer>
      <div class="flex gap-2">
        <Button
          class="aspect-square"
          onclick={() => {
            copyToClipboard();
          }}
          disabled={copyState !== 'idle'}
        >
          {#if copyState === 'copied'}
            <Check size={20} />
          {:else if copyState === 'error'}
            <XCircle size={20} />
          {:else}
            <Copy size={20} />
          {/if}
        </Button>
        <Button
          class="aspect-square"
          onclick={() => {
            downloadImage();
          }}
        >
          <FileArrowDown size={20} />
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
