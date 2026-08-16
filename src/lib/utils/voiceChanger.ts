// In-browser voice disguise for voice messages. Everything here runs on the
// client, on the raw microphone recording, before any network call — the
// same "sensitive data never leaves the browser unprocessed" rule the PGP
// identity already follows. The server and the wire only ever see the
// disguised (and then PGP-encrypted) clip.
//
// Deliberately dependency-free: pitch is shifted by changing playbackRate
// through an OfflineAudioContext (the classic chipmunk/helium-and-deep
// trick — pitch and speed move together). That's a feature here, not a
// limitation: altering cadence along with pitch breaks more of what makes a
// voice recognizable than a "pure" pitch shift would. Everything past that
// base pitch shift is built from a few standard Web Audio stages (ring
// modulation, band filtering, waveshaper distortion) mixed differently per
// preset — see STAGES below.

export type VoicePreset = 'deep' | 'helium' | 'robot' | 'alien' | 'radio' | 'monster';

export const VOICE_PRESETS: { id: VoicePreset; label: string }[] = [
  { id: 'deep', label: 'Deep' },
  { id: 'helium', label: 'Helium' },
  { id: 'robot', label: 'Robot' },
  { id: 'alien', label: 'Alien' },
  { id: 'radio', label: 'Radio' },
  { id: 'monster', label: 'Monster' }
];

const PLAYBACK_RATE: Record<VoicePreset, number> = {
  deep: 0.78,
  helium: 1.35,
  robot: 0.88,
  alien: 1.18,
  radio: 1.0,
  monster: 0.65
};

// Which extra effect stages each preset layers on top of its pitch shift.
// `ringHz`: amplitude-modulate the signal by a carrier at this frequency —
//   the classic "robot"/metallic timbre. Lower = more of a rumble, higher =
//   more of a buzz.
// `bandpass`: [highpass, lowpass] cutoffs in Hz — narrows the signal to a
//   telephone-style band, which also strips a lot of the low/high-end detail
//   that makes a voice individually identifiable.
// `distortion`: waveshaper drive amount — adds a gravelly/growl edge.
const STAGES: Record<
  VoicePreset,
  { ringHz?: number; bandpass?: [number, number]; distortion?: number }
> = {
  deep: {},
  helium: {},
  robot: { ringHz: 35 },
  alien: { ringHz: 60 },
  radio: { bandpass: [300, 3000], distortion: 10 },
  monster: { ringHz: 16, distortion: 35 }
};

// Standard WaveShaper "soft clip" distortion curve (the usual MDN/community
// formula) — `amount` controls how aggressively it drives the signal.
function makeDistortionCurve(amount: number): Float32Array {
  const sampleCount = 4096;
  const curve = new Float32Array(sampleCount);
  const deg = Math.PI / 180;
  for (let i = 0; i < sampleCount; i++) {
    const x = (i * 2) / sampleCount - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// Voice is intelligible well below CD quality; rendering at a low mono rate
// keeps the encrypted upload small without a lossy codec (we can't use
// MediaRecorder's opus output directly since it needs to be re-rendered
// through OfflineAudioContext for the pitch effect anyway).
const RENDER_SAMPLE_RATE = 16_000;

function writeAsciiString(view: DataView, offset: number, text: string) {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

// Minimal 16-bit PCM WAV encoder. `buffer` is already at the target sample
// rate/channel count (OfflineAudioContext rendered it that way), so this is
// just a header + interleave, no resampling.
function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;

  const out = new ArrayBuffer(44 + dataSize);
  const view = new DataView(out);

  writeAsciiString(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAsciiString(view, 8, 'WAVE');
  writeAsciiString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeAsciiString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      const sample = Math.max(-1, Math.min(1, channels[ch][i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([out], { type: 'audio/wav' });
}

// Decode once so switching presets in the picker doesn't re-touch the mic
// recording or redo the (comparatively slow) decode step each time.
export async function decodeRecording(blob: Blob): Promise<AudioBuffer> {
  const arrayBuffer = await blob.arrayBuffer();
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new AudioCtx();
  try {
    return await ctx.decodeAudioData(arrayBuffer);
  } finally {
    await ctx.close();
  }
}

// Apply the preset's pitch shift, on its own, at the recording's OWN sample
// rate — then hand the result to the effects pass below.
//
// This is split out because doing the pitch shift straight into the 16kHz
// render context silently truncated the recording. An AudioBufferSourceNode
// with `playbackRate !== 1` whose buffer's sample rate differs from the
// context's stops producing output early: with a 48kHz mic recording rendered
// into a 16kHz context, the audio ended after `rate` of the intended duration
// and the remainder came out silent. Measured at rate 0.65, a 5s recording
// filled only the first 5.02s of a correctly-sized 7.69s buffer — the last
// 35% of what the user said was replaced by silence, and the pitch was
// correct throughout, so nothing about the output looked wrong. Only the
// slow presets showed it (deep, robot, monster); rate >= 1 happened to escape
// because the output buffer is shorter than the source. Rendering at the
// buffer's own rate makes playbackRate behave, and plain resampling with
// playbackRate 1 (the pass below) was never affected.
async function renderPitchShift(decoded: AudioBuffer, rate: number): Promise<AudioBuffer> {
  if (rate === 1) return decoded;
  const outFrames = Math.max(1, Math.ceil(decoded.length / rate));
  const ctx = new OfflineAudioContext(decoded.numberOfChannels, outFrames, decoded.sampleRate);
  const source = ctx.createBufferSource();
  source.buffer = decoded;
  source.playbackRate.value = rate;
  source.connect(ctx.destination);
  source.start();
  return await ctx.startRendering();
}

// Render `decoded` through the chosen preset and return a small mono WAV
// blob ready to be encrypted and uploaded, plus its duration in seconds.
export async function applyVoicePreset(
  decoded: AudioBuffer,
  preset: VoicePreset
): Promise<{ blob: Blob; durationSec: number }> {
  const rate = PLAYBACK_RATE[preset];
  // Pitch first, at the source rate (see renderPitchShift). What comes back is
  // already `decoded.length / rate` frames long, so this pass only has to
  // resample it down to RENDER_SAMPLE_RATE — playbackRate stays 1 here.
  const pitched = await renderPitchShift(decoded, rate);
  const outFrames = Math.max(1, Math.ceil(pitched.duration * RENDER_SAMPLE_RATE));
  const offlineCtx = new OfflineAudioContext(1, outFrames, RENDER_SAMPLE_RATE);

  const source = offlineCtx.createBufferSource();
  source.buffer = pitched;

  // Chain the stages this preset uses, in order, ending at `node` — whatever
  // that is gets connected to the destination last.
  let node: AudioNode = source;
  const stage = STAGES[preset];

  if (stage.ringHz !== undefined) {
    // Ring modulation: multiply the signal by a carrier oscillator for a
    // metallic timbre. Connecting the oscillator straight into the gain's
    // AudioParam makes the carrier's -1..1 output BE the gain each sample,
    // i.e. output = input * carrier(t).
    const carrier = offlineCtx.createOscillator();
    carrier.frequency.value = stage.ringHz;
    const ringGain = offlineCtx.createGain();
    ringGain.gain.value = 0;
    carrier.connect(ringGain.gain);
    node.connect(ringGain);
    node = ringGain;
    carrier.start();
  }

  if (stage.bandpass) {
    const [hpHz, lpHz] = stage.bandpass;
    const highpass = offlineCtx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = hpHz;
    const lowpass = offlineCtx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = lpHz;
    node.connect(highpass);
    highpass.connect(lowpass);
    node = lowpass;
  }

  if (stage.distortion !== undefined) {
    const shaper = offlineCtx.createWaveShaper();
    // .slice() so its buffer is typed as plain ArrayBuffer, same reason
    // decrypted audio gets .slice()'d before wrapping in a Blob elsewhere.
    shaper.curve = makeDistortionCurve(stage.distortion).slice();
    node.connect(shaper);
    node = shaper;
  }

  node.connect(offlineCtx.destination);
  source.start();
  const rendered = await offlineCtx.startRendering();
  return { blob: encodeWav(rendered), durationSec: rendered.duration };
}

// Best available mimeType for MediaRecorder across browsers; undefined lets
// the browser pick its own default if none of these are supported.
export function pickRecorderMimeType(): string | undefined {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(type)) return type;
  }
  return undefined;
}
