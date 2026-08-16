<script lang="ts">
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import BlurhashThumbnail from './BlurhashThumbnail.svelte';
  import { domToPng } from 'modern-screenshot';
  import FileArrowDown from 'phosphor-svelte/lib/FileArrowDown';
  import Eraser from 'phosphor-svelte/lib/Eraser';
  import Copy from 'phosphor-svelte/lib/Copy';
  import Check from 'phosphor-svelte/lib/Check';
  import XCircle from 'phosphor-svelte/lib/XCircle';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button';
  import IdentityChip from '$lib/components/IdentityChip.svelte';
  import MessageText from './MessageText.svelte';
  import VoiceMessage from './VoiceMessage.svelte';
  interface Props {
    msg: any;
    decryptAudio?: (armored: string, authorRid: string) => Promise<Uint8Array | null>;
  }

  let { msg, decryptAudio }: Props = $props();

  let showExactTime = $state(false);
  let now = $state(new Date());
  let dialogOpen = $state(false);
  let copyState = $state<'idle' | 'copied' | 'error'>('idle');
  let redactMode = $state(false);
  let redactedIndices = $state(new Set<number>());

  const toggleRedactMode = () => {
    redactMode = !redactMode;
  };

  const toggleWordRedaction = (index: number) => {
    const next = new Set(redactedIndices);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    redactedIndices = next;
  };

  const timestamp = $derived(new Date(msg.timestamp ?? 0));
  const time = $derived.by(() => {
    const diff = Math.max(0, now.getTime() - timestamp.getTime());
    const relative = prettyMilliseconds(diff, { compact: true });
    const exact = timestamp.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit'
    });
    if (showExactTime) {
      return `${exact} (${relative})`;
    }
    return relative;
  });
  let messageElement: HTMLDivElement | undefined = $state(undefined);
  let preparingCapture = $state(false);

  // The dialog below mounts its own BlurhashThumbnail instance (a second,
  // independent one from the inline thumbnail in the message list), which
  // kicks off its own /api/images fetch on mount. If domToPng captures
  // before that resolves, the <img> it finds still has an empty src and the
  // screenshot comes out with the image portion blank. Wait for every <img>
  // under the capture target to actually finish loading first.
  async function waitForImagesToLoad(el: HTMLElement, timeoutMs = 8000): Promise<void> {
    const pending = Array.from(el.querySelectorAll('img')).filter(
      (img) => !img.complete || !img.src
    );
    if (!pending.length) return;
    await Promise.race([
      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
        )
      ),
      new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    ]);
  }

  const downloadImage = async () => {
    try {
      if (!messageElement) {
        console.error('No cardElement found');
        return;
      }

      preparingCapture = true;
      await waitForImagesToLoad(messageElement);

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
    } finally {
      preparingCapture = false;
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

      preparingCapture = true;
      await waitForImagesToLoad(messageElement);

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
    } finally {
      preparingCapture = false;
    }
  };

  onMount(() => {
    const interval = setInterval(() => {
      now = new Date();
    }, 10000);

    return () => clearInterval(interval);
  });
</script>

<div class=" group -m-2 flex w-full flex-row justify-between px-4 py-6 pr-3 pb-2" id="message">
  <div class="border-border bg-muted relative flex w-full flex-row justify-between border p-3">
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <span class="absolute -top-1 left-[-5px] flex flex-row text-sm">
      <IdentityChip rid={msg.r} bg="background" variant="tab" />
    </span>

    {#if msg.image && msg.image.id && msg.image.blurhash}
      <span class="border-primary absolute -top-5 left-32 h-7 w-7 border text-sm">
        <BlurhashThumbnail imageId={msg.image.id} />
      </span>
    {/if}

    <div class="flex w-full min-w-0 flex-col gap-2">
      <MessageText
        text={msg.msg}
        {redactMode}
        showHighlights={redactMode}
        {redactedIndices}
        onWordClick={toggleWordRedaction}
      />
      {#if msg.audio?.id && decryptAudio}
        <VoiceMessage
          audioId={msg.audio.id}
          authorRid={msg.r}
          duration={msg.audio.duration}
          {decryptAudio}
        />
      {/if}
    </div>
    <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center">
      <button
        class="text-xs hover:opacity-70 transition-opacity cursor-pointer"
        onclick={() => (showExactTime = !showExactTime)}
        title={showExactTime ? "Click to see relative time" : "Click to see exact time"}
      >
        {time}
      </button>
    </div>
    <span
      class="absolute -top-5 right-4 flex flex-row gap-1 transition-all lg:opacity-0 lg:group-hover:opacity-100"
    >
      <button
        class="border-primary flex h-7 w-7 items-center justify-center border text-sm transition-all
          {redactMode ? 'bg-primary text-primary-foreground' : 'bg-background'}"
        onclick={toggleRedactMode}
        title={redactMode ? 'Exit redact mode' : 'Redact words'}
      >
        <Eraser size={20} />
      </button>
      <button
        class="border-primary bg-background flex h-7 w-7 items-center justify-center border text-sm"
        onclick={() => {
          dialogOpen = !dialogOpen;
        }}
        title="Save image"
      >
        <FileArrowDown size={20} />
      </button>
    </span>
  </div>
</div>

<Dialog.Root bind:open={dialogOpen}>
  <Dialog.Content>
    <Dialog.Header>
      <Dialog.Title>Download image</Dialog.Title>
    </Dialog.Header>
    <div
      class="m-auto mt-4 flex aspect-square w-full max-w-full min-w-0 items-center justify-center overflow-hidden border border-black"
      bind:this={messageElement}
    >
      <div
        class=" group m-auto flex w-full min-w-0 flex-row justify-between px-4 py-6 pr-3 pb-2"
        id="message"
      >
        <div
          class="border-primary bg-muted relative flex w-full min-w-0 flex-row justify-between border p-3"
        >
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <span class="absolute -top-1 left-[-5px] flex flex-row text-sm">
            <IdentityChip rid={msg.r} bg="background" variant="tab" />
          </span>

          {#if msg.image && msg.image.id && msg.image.blurhash}
            <span class="border-primary absolute -top-5 left-32 h-7 w-7 border text-sm">
              <BlurhashThumbnail imageId={msg.image.id} />
            </span>
          {/if}

          <MessageText text={msg.msg} {redactedIndices} />
          <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center">
            <button
              class="text-xs hover:opacity-70 transition-opacity cursor-pointer"
              onclick={() => (showExactTime = !showExactTime)}
              title={showExactTime ? 'Click to show relative time' : 'Click to show exact time'}
            >
              {time}
            </button>
          </div>
        </div>
      </div>
    </div>
    <Dialog.Footer>
      <div class="flex gap-2">
        <Button
          class="aspect-square"
          onclick={() => {
            copyToClipboard();
          }}
          disabled={copyState !== 'idle' || preparingCapture}
        >
          {#if preparingCapture}
            <Spinner class="animate-spin" size={20} />
          {:else if copyState === 'copied'}
            <Check size={20} />
          {:else if copyState === 'error'}
            <XCircle size={20} />
          {:else}
            <Copy size={20} />
          {/if}
        </Button>
        <Button
          class="aspect-square"
          disabled={preparingCapture}
          onclick={() => {
            downloadImage();
          }}
        >
          {#if preparingCapture}
            <Spinner class="animate-spin" size={20} />
          {:else}
            <FileArrowDown size={20} />
          {/if}
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
