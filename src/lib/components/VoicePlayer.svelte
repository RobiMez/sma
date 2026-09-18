<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import Play from 'phosphor-svelte/lib/Play';
  import Pause from 'phosphor-svelte/lib/Pause';
  import Spinner from 'phosphor-svelte/lib/Spinner';
  import WarningCircle from 'phosphor-svelte/lib/WarningCircle';

  // One AudioContext for every player on the page. Chrome caps how many a
  // document may hold (around six), and an inbox can easily show more voice
  // notes than that, so one per component would start throwing on a busy room.
  // Module scope is safe here in a way it is not for room state: this is
  // created lazily inside a click handler, never during SSR, and holds nothing
  // belonging to a user.
  let sharedCtx: AudioContext | undefined;
  const audioCtx = () => (sharedCtx ??= new AudioContext());

  const BARS = 48;

  interface Props {
    /** Ready to play now. The recorder preview has the blob in hand already. */
    src?: string | null;
    /**
     * Fetch and decrypt on first play, for the inbox: the list poll leaves the
     * ciphertext out, so nothing is downloaded until someone actually presses
     * play. Returns an object URL, or null if the clip failed to verify.
     * The caller keeps ownership of that URL and revokes it.
     */
    load?: () => Promise<string | null>;
    /** Known before the audio is, so the row can show a length while idle. */
    duration?: number;
    /** Shown instead of the player when `load` refuses the clip. */
    errorText?: string;
    errorTitle?: string;
    class?: string;
  }

  let {
    src,
    load,
    duration = 0,
    errorText = 'Voice message failed to verify',
    errorTitle = '',
    class: className = ''
  }: Props = $props();

  let el: HTMLAudioElement | undefined = $state();
  let resolvedSrc: string | undefined = $state(src ?? undefined);
  let loading = $state(false);
  let failed = $state(false);
  let playing = $state(false);
  let current = $state(0);
  // Falls back to the passed-in duration until the file itself reports one,
  // which is what keeps the time from flicking to 0:00 on load.
  let total = $state(duration);
  let peaks: number[] = $state([]);

  // A recorder preview swaps its src every time the preset changes, so follow
  // the prop rather than reading it once.
  $effect(() => {
    if (src && src !== resolvedSrc) {
      resolvedSrc = src;
      current = 0;
      failed = false;
    }
  });

  // Analysis keyed on the resolved url, not on the prop, so it covers all
  // three ways a clip arrives: passed in at mount, swapped by a preset change,
  // and fetched on first play. Keying it on the prop meant a src that was
  // already there when the component mounted never got a waveform at all.
  let analysedSrc: string | undefined;
  $effect(() => {
    const url = resolvedSrc;
    if (!url || url === analysedSrc) return;
    analysedSrc = url;
    peaks = [];
    analyse(url);
  });

  /**
   * Bars are RMS per slice, not peak: speech is spiky, and peak-per-slice
   * renders as a near-solid block with a few tall spikes, which says nothing
   * about where the words are. RMS gives the familiar voice-note shape.
   *
   * This is an amplitude waveform. A true frequency spectrogram would need
   * around 32 rows to mean anything, and this strip is 32 pixels tall in
   * total, so it would read as a smear rather than as a picture of the sound.
   */
  async function analyse(url: string) {
    try {
      const bytes = await fetch(url).then((r) => r.arrayBuffer());
      const buf = await audioCtx().decodeAudioData(bytes);
      const data = buf.getChannelData(0);
      const block = Math.max(1, Math.floor(data.length / BARS));

      const raw: number[] = [];
      for (let i = 0; i < BARS; i++) {
        let sum = 0;
        const start = i * block;
        for (let j = 0; j < block; j++) sum += data[start + j] ** 2;
        raw.push(Math.sqrt(sum / block));
      }

      // Normalised against the loudest slice, so a quiet recording still draws
      // a full-height shape instead of a flat line.
      const loudest = Math.max(...raw);
      peaks = loudest > 0 ? raw.map((v) => v / loudest) : raw.map(() => 0);
      if (Number.isFinite(buf.duration)) total = buf.duration;
    } catch (e) {
      // A waveform is decoration. Failing to draw one must never stop the clip
      // from playing, so this swallows rather than setting the error state.
      console.warn('Could not read the waveform', e);
    }
  }

  async function toggle() {
    if (failed) return;

    if (!resolvedSrc) {
      if (!load || loading) return;
      loading = true;
      try {
        const url = await load();
        if (!url) {
          failed = true;
          return;
        }
        resolvedSrc = url;
        // The element only exists once resolvedSrc does, so without this the
        // first press loaded the clip and then returned without playing it.
        await tick();
      } finally {
        loading = false;
      }
    }

    if (!el) return;
    if (el.paused) await el.play();
    else el.pause();
  }

  // rAF rather than the element's own timeupdate, which fires about four times
  // a second and makes the progress edge visibly step.
  let frame = 0;
  const sampleTime = () => {
    if (el) current = el.currentTime;
    frame = requestAnimationFrame(sampleTime);
  };
  const startTicking = () => {
    playing = true;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(sampleTime);
  };
  const stopTicking = () => {
    playing = false;
    cancelAnimationFrame(frame);
    if (el) current = el.currentTime;
  };

  onDestroy(() => cancelAnimationFrame(frame));

  const progress = $derived(total > 0 ? Math.min(1, current / total) : 0);

  const seekTo = (fraction: number) => {
    if (!el || !Number.isFinite(el.duration)) return;
    el.currentTime = Math.max(0, Math.min(1, fraction)) * el.duration;
    current = el.currentTime;
  };

  // Pointer capture rather than window listeners, so a drag that leaves the
  // strip keeps scrubbing and still ends cleanly on release.
  let dragging = false;
  const seekFromPointer = (e: PointerEvent) => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    seekTo((e.clientX - box.left) / box.width);
  };
  const onPointerDown = (e: PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragging = true;
    seekFromPointer(e);
  };
  const onPointerMove = (e: PointerEvent) => {
    if (dragging) seekFromPointer(e);
  };
  const onPointerUp = (e: PointerEvent) => {
    dragging = false;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onKey = (e: KeyboardEvent) => {
    const step = 1 / 20;
    if (e.key === 'ArrowRight') seekTo(progress + step);
    else if (e.key === 'ArrowLeft') seekTo(progress - step);
    else if (e.key === 'Home') seekTo(0);
    else if (e.key === 'End') seekTo(1);
    else if (e.key === ' ' || e.key === 'Enter') toggle();
    else return;
    e.preventDefault();
  };

  // A WAV written by the voice changer can report its length a beat after
  // metadata, so listen for both events rather than only the first.
  const syncDuration = () => {
    if (el && Number.isFinite(el.duration) && el.duration > 0) total = el.duration;
  };

  const clock = (s: number) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  };
</script>

{#if failed}
  <span class="text-destructive flex items-center gap-1 text-xs" title={errorTitle}>
    <WarningCircle size={16} />
    {errorText}
  </span>
{:else}
  <!-- Cells divided by hairlines, like the header row and the attach row: the
       native control is a rounded blue pill that belongs to Chrome and ignores
       every token a room's theme sets. -->
  <div
    class="border-border bg-background flex h-9 max-w-full min-w-0 items-stretch border {className}"
  >
    <button
      type="button"
      class="border-border hover:bg-secondary flex w-9 shrink-0 items-center justify-center border-r transition-colors disabled:opacity-50"
      onclick={toggle}
      disabled={loading}
      aria-label={playing ? 'Pause voice message' : 'Play voice message'}
    >
      {#if loading}
        <Spinner class="size-4 animate-spin" weight="duotone" />
      {:else if playing}
        <Pause class="size-4" weight="fill" />
      {:else}
        <Play class="size-4" weight="fill" />
      {/if}
    </button>

    <div
      role="slider"
      tabindex="0"
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(total)}
      aria-valuenow={Math.round(current)}
      aria-valuetext="{clock(current)} of {clock(total)}"
      class="flex min-w-0 flex-auto cursor-pointer items-center gap-px px-2"
      onpointerdown={onPointerDown}
      onpointermove={onPointerMove}
      onpointerup={onPointerUp}
      onpointercancel={onPointerUp}
      onkeydown={onKey}
    >
      {#each peaks.length ? peaks : Array(BARS).fill(0) as level, i (i)}
        {@const played = peaks.length > 0 && i / BARS < progress}
        <span
          class="min-h-px w-full shrink {played
            ? 'bg-primary'
            : 'bg-muted-foreground opacity-35'} {peaks.length ? '' : 'opacity-20'}"
          style="height: {peaks.length ? 12 + level * 76 : 8}%"
        ></span>
      {/each}
    </div>

    <span
      class="text-muted-foreground border-border flex shrink-0 items-center border-l px-2 text-xs tabular-nums"
    >
      {clock(playing || current > 0 ? current : total)}
    </span>
  </div>
{/if}

{#if resolvedSrc}
  <!-- svelte-ignore a11y_media_has_caption -->
  <audio
    bind:this={el}
    src={resolvedSrc}
    class="hidden"
    onplay={startTicking}
    onpause={stopTicking}
    onended={stopTicking}
    onloadedmetadata={syncDuration}
    ondurationchange={syncDuration}
  ></audio>
{/if}
