<script lang="ts">
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import Stop from 'phosphor-svelte/lib/Stop';
  import X from 'phosphor-svelte/lib/X';
  import {
    VOICE_PRESETS,
    decodeRecording,
    applyVoicePreset,
    renderNeutralPcm16k,
    pickRecorderMimeType,
    type VoicePreset
  } from '$lib/utils/voiceChanger';
  import { Button } from '$lib/components/ui/button';

  // Bindable: the parent (`/b/[room]`) reads these straight off the recorder
  // to build the PATCH payload — this component owns everything up through
  // "here is the disguised clip", the parent owns encrypting + sending it.
  interface Props {
    blob: Blob | null;
    durationSec: number;
    rendering: boolean;
  }
  let {
    blob = $bindable(null),
    durationSec = $bindable(0),
    rendering = $bindable(false)
  }: Props = $props();

  const MAX_RECORD_SECONDS = 30;

  // typeof window guard first — SSR has no `window`, and `navigator.mediaDevices`
  // being falsy there currently short-circuits before reaching `window`, but
  // that's incidental, not a guarantee.
  let supported =
    typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia && !!window.MediaRecorder;

  let recording = $state(false);
  let elapsedSec = $state(0);
  let preset: VoicePreset = $state('deep');
  let previewUrl: string | null = $state(null);

  let mediaRecorder: MediaRecorder | undefined;
  let mediaStream: MediaStream | undefined;
  let recordedChunks: Blob[] = [];
  let decodedBuffer: AudioBuffer | undefined;
  let elapsedTimer: ReturnType<typeof setInterval> | undefined;

  function revokePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }

  async function renderPreset(next: VoicePreset) {
    if (!decodedBuffer) return;
    rendering = true;
    try {
      const result = await applyVoicePreset(decodedBuffer, next);
      revokePreview();
      blob = result.blob;
      durationSec = result.durationSec;
      previewUrl = URL.createObjectURL(result.blob);
    } finally {
      rendering = false;
    }
  }

  function selectPreset(next: VoicePreset) {
    preset = next;
    if (decodedBuffer) renderPreset(next);
  }

  async function startRecording() {
    if (!supported || recording) return;
    recordedChunks = [];
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(mediaStream, { mimeType: pickRecorderMimeType() });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      mediaStream?.getTracks().forEach((t) => t.stop());
      mediaStream = undefined;
      const rawBlob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType });
      decodedBuffer = await decodeRecording(rawBlob);
      await renderPreset(preset);
    };
    mediaRecorder.start();
    recording = true;
    elapsedSec = 0;
    elapsedTimer = setInterval(() => {
      elapsedSec += 1;
      if (elapsedSec >= MAX_RECORD_SECONDS) stopRecording();
    }, 1000);
  }

  function stopRecording() {
    if (elapsedTimer) clearInterval(elapsedTimer);
    elapsedTimer = undefined;
    recording = false;
    mediaRecorder?.stop();
  }

  function clearRecording() {
    revokePreview();
    blob = null;
    durationSec = 0;
    decodedBuffer = undefined;
    recordedChunks = [];
  }

  export function reset() {
    if (recording) stopRecording();
    clearRecording();
  }

  // For the parent's pre-send moderation check — the pre-disguise recording,
  // not the preset-rendered `blob` that actually gets sent (see
  // renderNeutralPcm16k for why). null if there's nothing recorded.
  export function getNeutralPcm(): Promise<Float32Array | null> {
    return decodedBuffer ? renderNeutralPcm16k(decodedBuffer) : Promise.resolve(null);
  }
</script>

{#if blob}
  <span
    class="bg-secondary/60 border-primary/30 flex flex-col gap-2 rounded-xs border p-2 sm:flex-row sm:items-center"
  >
    <audio src={previewUrl} controls class="h-8 max-w-[220px]"></audio>
    <span class="flex max-w-[280px] flex-wrap gap-1">
      {#each VOICE_PRESETS as p (p.id)}
        <button
          type="button"
          class="border-primary/40 border px-2 py-1 text-xs transition-all
            {preset === p.id ? 'bg-primary text-primary-foreground' : 'bg-background'}"
          disabled={rendering}
          onclick={() => selectPreset(p.id)}
        >
          {p.label}
        </button>
      {/each}
    </span>
    <Button onclick={clearRecording}>
      <X /> <span>Discard</span>
    </Button>
  </span>
{:else if recording}
  <button
    type="button"
    class="border-destructive bg-destructive/10 text-destructive flex items-center gap-2 rounded-xs border p-2 text-sm"
    onclick={stopRecording}
  >
    <Stop size="20" weight="fill" />
    Stop ({MAX_RECORD_SECONDS - elapsedSec}s left)
  </button>
{:else}
  <span
    class="bg-secondary/60 border-primary/30 hover:bg-secondary/80 text-secondary-foreground rounded-xs border p-2 transition-all"
  >
    <button
      type="button"
      class="flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={!supported}
      title={supported ? 'Record a voice message' : "This browser doesn't support recording"}
      onclick={startRecording}
    >
      <Microphone size="24" weight="duotone" />
      <span class="text-sm">Add voice</span>
    </button>
  </span>
{/if}
