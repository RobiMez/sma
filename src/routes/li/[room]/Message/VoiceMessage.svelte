<script lang="ts">
  import { onDestroy } from 'svelte';
  import { apiUrl } from '$lib/api';
  import SpeakerHigh from 'phosphor-svelte/lib/SpeakerHigh';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';
  import ClosedCaptioning from 'phosphor-svelte/lib/ClosedCaptioning';
  import { transcribeVoiceClip, type TranscribeProgress } from '$lib/utils/transcribe';

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
  let wavBlob: Blob | undefined;

  let transcribeState: 'idle' | 'loading-model' | 'transcribing' | 'done' | 'error' =
    $state('idle');
  let modelProgress = $state(0);
  let transcript = $state('');

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
      wavBlob = new Blob([decrypted.slice()], { type: 'audio/wav' });
      objectUrl = URL.createObjectURL(wavBlob);
      loadState = 'ready';
    } catch (e) {
      console.error('Failed to load voice message', e);
      loadState = 'error';
    }
  }

  // Entirely on-device (see transcribe.ts) — nothing here is sent anywhere.
  // Only reachable once the clip is decrypted, so there's always a `wavBlob`.
  async function transcribe() {
    if (!wavBlob || transcribeState === 'loading-model' || transcribeState === 'transcribing') {
      return;
    }
    transcribeState = 'loading-model';
    modelProgress = 0;
    try {
      const text = await transcribeVoiceClip(wavBlob, (p: TranscribeProgress) => {
        if (p.phase === 'loading-model') {
          modelProgress = p.percent;
        } else {
          transcribeState = 'transcribing';
        }
      });
      transcript = text || '(no speech detected)';
      transcribeState = 'done';
    } catch (e) {
      console.error('Failed to transcribe voice message', e);
      transcribeState = 'error';
    }
  }

  onDestroy(() => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  });
</script>

{#if loadState === 'ready' && objectUrl}
  <span class="flex flex-col gap-1">
    <span class="flex items-center gap-2">
      <audio src={objectUrl} controls class="h-8 max-w-[220px]"></audio>
      {#if transcribeState === 'idle'}
        <button
          type="button"
          class="border-primary/40 bg-background flex items-center gap-1 border px-2 py-1 text-xs"
          onclick={transcribe}
          title="Transcribe on-device (English) — nothing is uploaded"
        >
          <ClosedCaptioning size={16} weight="duotone" /> Transcribe
        </button>
      {:else if transcribeState === 'loading-model'}
        <span class="text-muted-foreground flex items-center gap-1 text-xs">
          <Spinner class="animate-spin" size={16} /> Downloading model… {modelProgress}%
        </span>
      {:else if transcribeState === 'transcribing'}
        <span class="text-muted-foreground flex items-center gap-1 text-xs">
          <Spinner class="animate-spin" size={16} /> Transcribing…
        </span>
      {:else if transcribeState === 'error'}
        <!-- Clickable: a failed load is usually transient (offline, a dropped
             chunk), and transcribe.ts no longer caches the failure, so there's
             a real retry to offer rather than making the recipient reload. -->
        <button
          type="button"
          class="text-destructive flex items-center gap-1 text-xs underline-offset-2 hover:underline"
          onclick={transcribe}
          title="Transcription failed — click to try again"
        >
          <WarningCircle size={16} /> Transcription failed — retry
        </button>
      {/if}
    </span>
    {#if transcribeState === 'done'}
      <span class="text-muted-foreground border-primary/20 border-l-2 pl-2 text-xs italic">
        “{transcript}”
      </span>
    {/if}
  </span>
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
