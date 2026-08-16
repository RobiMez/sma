<script lang="ts">
  import Microphone from 'phosphor-svelte/lib/Microphone';
  import Stop from 'phosphor-svelte/lib/Stop';
  import X from 'phosphor-svelte/lib/X';
  import {
    VOICE_PRESETS,
    decodeRecording,
    applyVoicePreset,
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
  // Why the last recording attempt failed, '' when there's nothing to report.
  let micError = $state('');

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
    micError = '';

    // Every failure below used to be an unhandled rejection: the mic prompt
    // getting denied just left the button sitting there as if nothing had
    // happened. Tell the sender what went wrong instead — this is the first
    // thing a new user hits, so silence reads as "voice messages are broken".
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      console.error('Could not open the microphone', e);
      const name = (e as DOMException)?.name;
      micError =
        name === 'NotAllowedError' || name === 'SecurityError'
          ? 'Microphone blocked — allow mic access for this site, then try again.'
          : 'No microphone available.';
      return;
    }

    try {
      mediaStream = stream;
      mediaRecorder = new MediaRecorder(stream, { mimeType: pickRecorderMimeType() });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      mediaRecorder.onstop = async () => {
        mediaStream?.getTracks().forEach((t) => t.stop());
        mediaStream = undefined;
        try {
          const rawBlob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType });
          decodedBuffer = await decodeRecording(rawBlob);
          await renderPreset(preset);
        } catch (e) {
          // Decoding an empty or codec-mismatched clip throws here. Same rule
          // as above: say so rather than silently returning to the idle button.
          console.error('Could not process the recording', e);
          micError = "That recording couldn't be processed — try again.";
          clearRecording();
        }
      };
      mediaRecorder.start();
    } catch (e) {
      // Constructing or starting the recorder can still fail even after the
      // mic opened. Release it rather than leaving the browser's recording
      // indicator lit with nothing actually recording.
      console.error('Could not start the recorder', e);
      stream.getTracks().forEach((t) => t.stop());
      mediaStream = undefined;
      mediaRecorder = undefined;
      micError = "This browser wouldn't start a recording.";
      return;
    }

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
    elapsedSec = 0;
    decodedBuffer = undefined;
    recordedChunks = [];
  }

  export function reset() {
    if (recording) stopRecording();
    clearRecording();
  }
</script>

{#if blob}
  <span
    class="bg-secondary/60 border-primary/30 flex w-full min-w-0 flex-col gap-2 rounded-xs border p-2 sm:w-auto sm:flex-row sm:items-center"
  >
    <audio src={previewUrl} controls class="h-8 w-full sm:w-[220px]"></audio>
    <!-- A plain wrap left "Monster" orphaned on a row of its own. Six short
         labels go two even rows of three on a phone and a single row once
         there's width for it. -->
    <span class="grid grid-cols-3 gap-1 sm:flex sm:flex-wrap">
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
    <Button onclick={clearRecording} class="w-full sm:w-auto">
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
  <span class="flex flex-col gap-1">
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
    {#if micError}
      <span class="text-destructive max-w-[220px] text-xs">{micError}</span>
    {/if}
  </span>
{/if}
