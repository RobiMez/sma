<script module lang="ts">
  import { apiUrl } from '$lib/api';

  // One fetch per image for the whole page. The inbox row and the save-as-image
  // dialog both draw the same picture, and before this each kicked off its own
  // /api/images request for the full data URI. Only ever written from an
  // effect, which never runs during SSR, so this map cannot carry anything
  // between two server requests.
  const cache = new Map<string, Promise<string | null>>();

  async function fetchImage(id: string): Promise<string | null> {
    try {
      const response = await fetch(apiUrl(`/api/images?id=${encodeURIComponent(id)}`));
      const resp = await response.json();
      // Every response here is `{ status, body }`, never `{ error, message }`.
      if (resp.status !== 200) {
        console.error('Failed to fetch image:', resp.body);
        return null;
      }
      const src = (resp.body?.dataURI ?? []).join('');
      // Images are not encrypted and a modified client can store any string
      // here. An http(s) URL would make the room owner's browser fetch it,
      // handing their IP to whoever sent it, so only inline image data is drawn.
      if (!src.startsWith('data:image/')) {
        console.error('Refusing image that is not an inline data URI');
        return null;
      }
      return src;
    } catch (error) {
      console.error('Failed to fetch image:', error);
      return null;
    }
  }

  function loadImage(id: string): Promise<string | null> {
    let pending = cache.get(id);
    if (!pending) {
      pending = fetchImage(id);
      cache.set(id, pending);
      // A failure is not remembered, so the next mount gets a fresh try.
      pending.then((src) => {
        if (src === null) cache.delete(id);
      });
    }
    return pending;
  }

  // What "Save photo" will write to disk. SVG is left out on purpose: a saved
  // .svg opened from the downloads folder runs its scripts, and the sender
  // chose those bytes. Drawing one in an <img> stays harmless, so it still
  // displays, it just has no save button.
  const SAVEABLE: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif'
  };

  function mimeOf(src: string): string {
    return src.slice(5, src.indexOf(';')).toLowerCase();
  }
</script>

<script lang="ts">
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import ImageBroken from 'phosphor-svelte/lib/ImageBroken';
  import DownloadSimple from 'phosphor-svelte/lib/DownloadSimple';
  import * as Dialog from '$lib/components/ui/dialog';
  import { Button } from '$lib/components/ui/button';

  interface Props {
    imageId: string;
    /** Tap to open the full view. Off inside the save-as-image capture. */
    interactive?: boolean;
  }

  let { imageId, interactive = true }: Props = $props();

  let src = $state<string | null>(null);
  let failed = $state(false);
  let saveState = $state<'idle' | 'error'>('idle');

  $effect(() => {
    const id = imageId;
    let live = true;
    src = null;
    failed = false;
    loadImage(id).then((loaded) => {
      if (!live) return;
      src = loaded;
      failed = loaded === null;
    });
    return () => {
      live = false;
    };
  });

  const ext = $derived(src ? SAVEABLE[mimeOf(src)] : undefined);

  // A Blob URL, not the data URI itself: Android Chrome quietly refuses to
  // download a data: link once it runs to a few megabytes, which a phone photo
  // does.
  const savePhoto = async () => {
    if (!src || !ext) return;
    try {
      const blob = await (await fetch(src)).blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sma-image-${imageId}.${ext}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      console.error('Failed to save image:', error);
      saveState = 'error';
      setTimeout(() => (saveState = 'idle'), 2000);
    }
  };
</script>

<!-- Width comes from the card, height from the picture, up to a cap. A tall
     screenshot stops at the cap and is letterboxed on the column colour rather
     than cropped, because a meme's punchline is usually at the bottom.

     The cap is a share of the screen, not a fixed size. At 28rem a 16:9 photo
     in the 828px desktop column came up 18px short and sat between two thin
     bands, which reads as a layout bug. At 70svh landscape photos fill the
     width and only something clearly tall gets bands, which reads as meant. -->
{#snippet picture()}
  <img
    {src}
    alt="Attached to this message"
    class="block max-h-[70svh] w-full object-contain"
  />
{/snippet}

{#if src}
  {#if interactive}
    <Dialog.Root>
      <Dialog.Trigger
        class="bg-background block w-full cursor-zoom-in transition-opacity hover:opacity-90"
        aria-label="Open image"
      >
        {@render picture()}
      </Dialog.Trigger>
      <Dialog.Content class="max-h-[calc(100dvh-2rem)] sm:max-w-3xl">
        <Dialog.Header>
          <Dialog.Title>Image</Dialog.Title>
        </Dialog.Header>
        <img {src} alt="Attached to this message" class="bg-muted max-h-[70dvh] w-full object-contain" />
        {#if ext}
          <Dialog.Footer>
            <Button onclick={savePhoto}>
              <DownloadSimple size={18} />
              {saveState === 'error' ? 'Could not save' : 'Save photo'}
            </Button>
          </Dialog.Footer>
        {/if}
      </Dialog.Content>
    </Dialog.Root>
  {:else}
    <div class="bg-background w-full">{@render picture()}</div>
  {/if}
{:else if failed}
  <div class="bg-background text-muted-foreground flex w-full items-center gap-2 p-3 text-sm">
    <ImageBroken size={18} />
    This image could not be loaded.
  </div>
{:else}
  <!-- data-image-pending is what the save-as-image capture waits on. Without
       it there is no <img> in the DOM yet, so a capture would find nothing to
       wait for and export this placeholder instead of the picture. -->
  <div
    data-image-pending
    class="bg-background text-muted-foreground flex aspect-[4/3] max-h-[70svh] w-full items-center justify-center"
  >
    <Spinner class="animate-spin" size={20} />
  </div>
{/if}
