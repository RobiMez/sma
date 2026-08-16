<script lang="ts">
  import { onDestroy } from 'svelte';
  import { apiUrl } from '$lib/api';
  import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';

  // Lazy: the list poll (`GET /api/pgp`) excludes the audio ciphertext (see
  // the `-dataURI` populate in that route) so it stays small, same reason
  // full images are fetched on demand via BlurhashThumbnail. Decrypt +
  // signature verification only happen once the recipient taps play.
  interface Props {
    audioId: string;
    authorRid: string;
    duration?: number;
    decryptAudio: (armored: string, authorRid: string) => Promise<Uint8Array | null>;
  }
  let { audioId, authorRid, duration = 0, decryptAudio }: Props = $props();

  // Not named `state` — Svelte 5 reads a bare `$state(...)` call next to a
  // same-named local as legacy store auto-subscription ($state) and errors.
  let loadState: 'idle' | 'loading' | 'ready' | 'error' = $state('idle');
  let objectUrl: string | undefined = $state();

  async function load() {
    if (loadState === 'loading' || loadState === 'ready') return;
    loadState = 'loading';
    try {
      const res = await fetch(apiUrl(`/api/audio?id=${audioId}`));
      const resp = await res.json();
      // Every response here is `{ status, body }`, never `{ error, message }`.
      if (resp.status !== 200) throw new Error(`Fetching audio failed: ${resp.body}`);

      const armored = (resp.body.dataURI as string[]).join('');
      const decrypted = await decryptAudio(armored, authorRid);
      if (!decrypted) {
        // Unsigned, or signed by a key that doesn't match the claimed
        // author — same "treat as spoof" rule the text messages use.
        loadState = 'error';
        return;
      }

      // .slice() (not the raw Uint8Array) so its buffer is typed as a plain
      // ArrayBuffer — Blob's constructor type doesn't accept the more
      // general ArrayBufferLike a decrypted openpgp Uint8Array carries.
      objectUrl = URL.createObjectURL(new Blob([decrypted.slice()], { type: 'audio/wav' }));
      loadState = 'ready';
    } catch (e) {
      console.error('Failed to load voice message', e);
      loadState = 'error';
    }
  }

  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

{#if loadState === 'ready' && objectUrl}
  <audio src={objectUrl} controls class="h-8 max-w-[220px]"></audio>
{:else if loadState === 'error'}
  <span
    class="text-destructive flex items-center gap-1 text-xs"
    title="Signature didn't verify against the claimed sender — possibly spoofed"
  >
    <WarningCircle size={16} /> Voice message failed to verify
  </span>
{:else}
  <button
    type="button"
    class="border-primary/40 bg-background flex items-center gap-2 border px-2 py-1 text-xs"
    onclick={load}
    disabled={loadState === 'loading'}
  >
    {#if loadState === 'loading'}
      <Spinner class="animate-spin" size={16} />
    {:else}
      <SpeakerHigh size={16} weight="duotone" />
    {/if}
    Voice message{duration ? ` (${Math.round(duration)}s)` : ''}
  </button>
{/if}
