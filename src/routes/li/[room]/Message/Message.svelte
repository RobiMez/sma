<script lang="ts">
  import prettyMilliseconds from 'pretty-ms';
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import MessageImage from './MessageImage.svelte';
  import { domToBlob } from 'modern-screenshot';
  import FileArrowDown from 'phosphor-svelte/lib/FileArrowDown';
  import Eraser from 'phosphor-svelte/lib/Eraser';
  import Copy from 'phosphor-svelte/lib/Copy';
  import Check from 'phosphor-svelte/lib/Check';
  import XCircle from 'phosphor-svelte/lib/XCircle';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import ArrowBendUpLeft from 'phosphor-svelte/lib/ArrowBendUpLeft';
  import ClipboardText from 'phosphor-svelte/lib/ClipboardText';
  import * as Dialog from '$lib/components/ui/dialog/index.js';
  import { Button } from '$lib/components/ui/button';
  import Textarea from '$lib/components/ui/textarea/textarea.svelte';
  import IdentityChip from '$lib/components/IdentityChip.svelte';
  import MessageText from './MessageText.svelte';
  import VoiceMessage from './VoiceMessage.svelte';
  interface Props {
    msg: any;
    decryptAudio?: (armored: string, authorRid: string) => Promise<Uint8Array | null>;
    /** Encrypt + post a reply scoped to this message; see /li/[room]/+page.svelte. */
    sendReply?: (
      messageId: string,
      senderRid: string,
      text: string
    ) => Promise<{ ok: boolean; error?: string }>;
  }

  let { msg, decryptAudio, sendReply }: Props = $props();

  let showExactTime = $state(false);
  let now = $state(new Date());
  let dialogOpen = $state(false);
  let copyState = $state<'idle' | 'copied' | 'error'>('idle');
  let redactMode = $state(false);
  let redactedIndices = $state(new Set<number>());

  let replying = $state(false);
  let replyDraft = $state('');
  let replySending = $state(false);
  let replyError = $state('');

  // Plain-text copy, distinct from the dialog's "copy as image" — the text is
  // already decrypted in memory here, so this is just a clipboard write.
  let copyTextState = $state<'idle' | 'copied' | 'error'>('idle');

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(msg.msg ?? '');
      copyTextState = 'copied';
    } catch (error) {
      console.error('Failed to copy message text:', error);
      copyTextState = 'error';
    }
    setTimeout(() => {
      copyTextState = 'idle';
    }, 2000);
  };

  const replies = $derived((msg.replies ?? []) as { id: string; text: string; timestamp: string }[]);

  // The picture fills the card's content column. An image with nothing under
  // it leaves the corner timestamp nothing to sit beside, so it gets a strip
  // of its own instead of landing on the picture.
  const hasImage = $derived(!!msg.image?.id);
  const imageOnly = $derived(hasImage && !msg.msg && !msg.audio?.id);

  const submitReply = async () => {
    if (!sendReply || replySending || !replyDraft.trim()) return;
    replySending = true;
    replyError = '';
    try {
      const result = await sendReply(msg.id, msg.r, replyDraft);
      if (!result.ok) {
        // Keep the draft on failure — a rejected reply the sender has to
        // retype is a worse outcome than the failure itself.
        replyError = result.error ?? 'Could not send the reply.';
        return;
      }
      replyDraft = '';
      replying = false;
    } finally {
      replySending = false;
    }
  };

  const formatReplyTime = (iso: string) => {
    const date = new Date(iso ?? 0);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

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
  let downloadState = $state<'idle' | 'error'>('idle');

  // The dialog below draws its own MessageImage, and domToBlob snapshots
  // whatever is in the DOM right now: it does not wait for async content. So
  // wait for two things. First, no image may still be fetching: those render a
  // placeholder marked data-image-pending and no <img> at all, so an
  // img-only check would find nothing to wait for and export the spinner.
  // Then every <img> has to finish decoding, or it paints blank.
  async function waitForImagesToLoad(el: HTMLElement, timeoutMs = 8000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline && el.querySelector('[data-image-pending]')) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    await Promise.race([
      Promise.allSettled(Array.from(el.querySelectorAll('img')).map((img) => img.decode())),
      new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, deadline - Date.now())))
    ]);
  }

  const captureCard = async (el: HTMLElement) => {
    await waitForImagesToLoad(el);
    return domToBlob(el, {
      type: 'image/png',
      // Resolved, not 'var(--background)': this is painted onto a canvas,
      // where a CSS variable is not a colour and silently yields nothing.
      backgroundColor: getComputedStyle(el).backgroundColor,
      scale: 4
    });
  };

  const downloadImage = async () => {
    if (!messageElement) return;
    preparingCapture = true;
    try {
      const blob = await captureCard(messageElement);
      // A Blob URL, not a data: URL. Chrome caps the URLs it will hand to a
      // download, and a card with a photo filling it, exported at 4x, runs to
      // megabytes where a text card stays in the hundreds of kilobytes.
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `message-${msg.r}-${new Date().toISOString()}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error('Failed to export message as image:', error);
      downloadState = 'error';
      setTimeout(() => (downloadState = 'idle'), 2000);
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
      const blob = await captureCard(messageElement);

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

<!-- flex-col, not flex-row: the reply thread hangs below the message bubble as
     a sibling, so it can't be swallowed by the bubble's absolutely-positioned
     timestamp in the corner. -->
<!-- -my-2, not -m-2: the negative margin exists purely for the vertical
     maths below, and on the horizontal axis it shifted the whole card 8px
     left of its container, so message rows sat at 8px on the left and 24px
     on the right while every other row sat at 16px on both.

     pb-2.5 is load-bearing, not a round number. The identity chip and the
     hover toolbar both hang 19px above their card's top edge, so the gap
     between cards has to be 18px for a chip's top border to land exactly on
     the previous card's bottom border. At 20px they missed by 1px and left a
     hairline of page background between them, which read as a seam rather
     than as a tab welded to the stack. 10 + 24 - 16 (margin) = 18.

     Uniform on every row: the spacing is invisible either way, so every row
     reserves it. -->
<div class=" group -my-2 flex w-full flex-col px-4 py-6 pb-2.5" id="message">
  <div class="relative w-full min-w-0">
    <div class="border-border bg-muted relative flex w-full flex-row justify-between border p-4">
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <span class="absolute -top-1 left-[-5px] flex flex-row items-center gap-1 text-sm">
        <IdentityChip rid={msg.r} bg="background" variant="tab" />
      </span>

      <div class="flex w-full min-w-0 flex-col gap-2">
        {#if hasImage}
          <div class="mb-1"><MessageImage imageId={msg.image.id} /></div>
        {/if}
        {#if msg.msg}
          <MessageText
            text={msg.msg}
            {redactMode}
            showHighlights={redactMode}
            {redactedIndices}
            onWordClick={toggleWordRedaction}
          />
        {/if}
        {#if imageOnly}
          <div class="h-3" aria-hidden="true"></div>
        {/if}
        {#if msg.audio?.id && decryptAudio}
          <VoiceMessage
            audioId={msg.audio.id}
            authorRid={msg.r}
            duration={msg.audio.duration}
            {decryptAudio}
          />
        {/if}
      </div>
      <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center gap-1">
        {#if msg.editedAt}
          <!-- The sender can rewrite what they sent (see /api/sent); say so
               rather than silently swapping the text under the recipient. -->
          <span
            class="text-muted-foreground text-xs italic"
            title="Edited by the sender at {new Date(msg.editedAt).toLocaleString()}"
          >
            edited
          </span>
        {/if}
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
        {#if sendReply}
          <button
            class="border-border flex h-7 w-7 items-center justify-center border text-sm transition-all
              {replying ? 'bg-primary text-primary-foreground' : 'bg-background'}"
            onclick={() => {
              replying = !replying;
              replyError = '';
            }}
            title={replying ? 'Cancel reply' : 'Reply to this message'}
          >
            <ArrowBendUpLeft size={20} />
          </button>
        {/if}
        <button
          class="border-border bg-background flex h-7 w-7 items-center justify-center border text-sm disabled:opacity-40"
          onclick={copyText}
          disabled={!msg.msg}
          title={msg.msg ? 'Copy text' : 'No text to copy'}
        >
          {#if copyTextState === 'copied'}
            <Check size={20} />
          {:else if copyTextState === 'error'}
            <XCircle size={20} />
          {:else}
            <ClipboardText size={20} />
          {/if}
        </button>
        <button
          class="border-border flex h-7 w-7 items-center justify-center border text-sm transition-all
            {redactMode ? 'bg-primary text-primary-foreground' : 'bg-background'}"
          onclick={toggleRedactMode}
          title={redactMode ? 'Exit redact mode' : 'Redact words'}
        >
          <Eraser size={20} />
        </button>
        <button
          class="border-border bg-background flex h-7 w-7 items-center justify-center border text-sm"
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

  <!-- Only this browser can read these: they were encrypted to the sender and
       to us, and every one shown here had its signature verified upstream. -->
  {#if replies.length || replying}
    <div class="border-primary/30 mt-1 ml-6 flex flex-col gap-1 border-l pl-3">
      {#each replies as reply (reply.id)}
        <div class="border-primary/20 bg-secondary/20 border p-2">
          <p class="text-sm break-words whitespace-pre-wrap">{reply.text}</p>
          <span class="text-muted-foreground text-xs">
            you replied · {formatReplyTime(reply.timestamp)}
          </span>
        </div>
      {/each}

      {#if replying}
        <div transition:slide={{ duration: 150 }} class="flex flex-col gap-2 pt-1">
          <Textarea
            bind:value={replyDraft}
            maxlength={1000}
            placeholder="Reply to this message..."
            class="w-full border border-border p-2"
          />
          {#if replyError}
            <span class="bg-destructive/10 text-destructive p-2 text-sm">{replyError}</span>
          {/if}
          <div class="flex items-center gap-2">
            <Button onclick={submitReply} disabled={replySending || !replyDraft.trim()}>
              {#if replySending}
                <Spinner class="size-4 animate-spin" weight="duotone" />
                Sending
              {:else}
                Send reply
              {/if}
            </Button>
            <Button
              variant="ghost"
              onclick={() => {
                replying = false;
                replyError = '';
              }}
              disabled={replySending}
            >
              Cancel
            </Button>
            <span class="text-muted-foreground ml-auto text-xs">{replyDraft.length}/1000</span>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<Dialog.Root bind:open={dialogOpen}>
  <!-- Scrolls rather than running off a phone screen once a tall photo is in
       the card. The capture is of the element, not the viewport, so a
       scrolled-off part still lands in the PNG. -->
  <Dialog.Content
    class="max-h-[calc(100dvh-2rem)] overflow-y-auto [scrollbar-color:var(--border)_transparent] [scrollbar-width:thin]"
  >
    <Dialog.Header>
      <Dialog.Title>Download image</Dialog.Title>
    </Dialog.Header>
    <!-- A square at least, taller when the card is. The sizer shares the one
         grid cell with the card, so the row is as tall as whichever is taller.
         This used to be aspect-square plus overflow-hidden, which was fine for
         a line of text and cut the bottom off a card with a photo in it.
         grid-cols-1 is load-bearing: an implicit grid column sizes to its
         content, and an <img> brings its natural width, so a 720px screenshot
         pushed the card out past the dialog. And overflow-clip, not -hidden:
         hidden makes this a scroll container, whose minimum height is 0, so
         the dialog's height cap squeezed it and the PNG lost the card's
         bottom 87px. clip cuts the same way without becoming a scroller. -->
    <div
      class="bg-background mt-4 grid w-full max-w-full min-w-0 grid-cols-1 overflow-clip border border-border"
      bind:this={messageElement}
    >
      <div class="col-start-1 row-start-1 aspect-square w-full" aria-hidden="true"></div>
      <div
        class=" group col-start-1 row-start-1 flex w-full min-w-0 flex-row justify-between self-center px-4 pt-8 pb-3"
        id="message"
      >
        <div class="relative w-full min-w-0">
          <div
            class="border-border bg-muted relative flex w-full min-w-0 flex-row justify-between border p-4"
          >
            <!-- svelte-ignore a11y_no_static_element_interactions -->
            <!-- svelte-ignore a11y_click_events_have_key_events -->
            <span class="absolute -top-1 left-[-5px] flex flex-row text-sm">
              <IdentityChip rid={msg.r} bg="background" variant="tab" />
            </span>

            <div class="flex w-full min-w-0 flex-col gap-2">
              {#if hasImage}
                <div class="mb-1"><MessageImage imageId={msg.image.id} interactive={false} /></div>
              {/if}
              {#if msg.msg}
                <MessageText text={msg.msg} {redactedIndices} />
              {/if}
              <!-- No voice player in the export, so a picture with only a
                   voice note under it is image-only here. -->
              {#if hasImage && !msg.msg}
                <div class="h-3" aria-hidden="true"></div>
              {/if}
            </div>
            <div class="absolute right-2 bottom-2 flex flex-row items-center justify-center gap-1">
              {#if msg.editedAt}
                <span class="text-muted-foreground text-xs italic">edited</span>
              {/if}
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
          {:else if downloadState === 'error'}
            <XCircle size={20} />
          {:else}
            <FileArrowDown size={20} />
          {/if}
        </Button>
      </div>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
