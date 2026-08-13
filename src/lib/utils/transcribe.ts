// On-device speech-to-text for voice messages. Runs entirely in the browser
// via a small English Whisper checkpoint (transformers.js) — nothing is
// uploaded anywhere to transcribe. Same rule the PGP identity and the voice
// disguise already follow: audio only ever gets processed on-device.
//
// Two callers, one model: the recipient's on-demand "Transcribe" button
// (VoiceMessage.svelte, via transcribeVoiceClip on the decrypted WAV) and
// the sender's pre-send moderation check (/b/[room]/+page.svelte, via
// transcribePcm on the pre-disguise recording — see renderNeutralPcm16k in
// voiceChanger.ts for why that has to be the undisguised audio).
//
// `@huggingface/transformers` (~model weights, not the JS itself) is a heavy
// optional add-on, so it's dynamically imported here and only touched when
// the recipient actually presses "Transcribe" — it's not part of the app's
// normal bundle. The model itself is downloaded once by the browser and
// cached in Cache Storage by transformers.js, so repeat transcriptions (even
// across page loads) don't re-download it.
//
// dtype: 'q8' is load-bearing, not a nice-to-have — measured directly: this
// repo's default (fp32) weights are ~144MB (31MB encoder + 113MB decoder);
// q8 is ~39MB (9.7MB + 29MB) for the same model. The library is *supposed*
// to default to q8 on a wasm backend on its own, but that only fires if its
// device auto-detection resolves to exactly "wasm" — leaving it implicit
// risks silently falling back to the 144MB fp32 weights (slow/stalls on a
// real connection, easily read as "transcription doesn't work"). q4 was also
// tried and is NOT smaller here (its decoder is actually ~83MB, bigger than
// q8's) as well as less accurate, so q8 is the genuine sweet spot for this
// model, not just "a safe default".
//
// graphOptimizationLevel: 'disabled' works around a real onnxruntime-web bug,
// not a defensive default — confirmed by reproducing outside the browser:
// this exact model+dtype loads fine under onnxruntime-node (native), but
// failed in-browser with "Can't create a session... qdq_actions.cc:137
// TransposeDQWeightsForMatMulNBits Missing required scale" for the decoder's
// tied embed_tokens weight. Inspecting the actual .onnx file (`strings` on
// the binary) shows it only contains standard QuantizeLinear/
// DequantizeLinear ops — no MatMulNBits at all, and the "missing" scale
// initializer is right there in the file. So the file is fine; the crash is
// onnxruntime-web's own optimizer trying to *fuse* that QDQ pattern into a
// MatMulNBits op at load time (that's what TransposeDQWeightsForMatMulNBits
// is — an ORT transform, not anything in our model) and failing on this
// weight-transpose shape. `@huggingface/transformers` pins a dev/nightly
// onnxruntime-web build (not a stable release) across every version checked
// (3.x through 4.2.0), so downgrading the package doesn't sidestep it.
// That fusion lives at the 'extended' optimization level or above; dropping
// to 'disabled' skips it. Couldn't verify empirically against a real browser
// from here, so this is the conservative choice (skips ALL graph
// optimizations, not just the suspected one) — if transformers.js ships a
// fixed onnxruntime-web build later, it's worth trying 'basic' or 'all'
// again to get any perf back.

import { decodeWavPcm } from './voiceChanger';
import type {
  AutomaticSpeechRecognitionPipeline,
  ProgressInfo
} from '@huggingface/transformers';

// English-only checkpoint: smaller and faster than the multilingual build,
// which is the right trade for short voice notes recorded in English.
const MODEL_ID = 'Xenova/whisper-tiny.en';

export type TranscribeProgress =
  | { phase: 'loading-model'; percent: number }
  | { phase: 'transcribing' };

let pipelinePromise: Promise<AutomaticSpeechRecognitionPipeline> | null = null;

// `progress_total` fires once per HTTP chunk — for a ~39MB download over a
// fast connection that's easily hundreds of calls a second. Driving a Svelte
// $state update that often is pure jank for no visible benefit; a human
// can't perceive updates faster than this anyway. Coalesce to ~8/sec, and
// always let 100% through so the caller can reliably detect completion.
const PROGRESS_THROTTLE_MS = 120;

function loadPipeline(onProgress?: (p: TranscribeProgress) => void) {
  if (!pipelinePromise) {
    let lastEmit = 0;
    pipelinePromise = import('@huggingface/transformers').then(({ pipeline }) =>
      pipeline('automatic-speech-recognition', MODEL_ID, {
        dtype: 'q8',
        session_options: { graphOptimizationLevel: 'disabled' },
        progress_callback: (info: ProgressInfo) => {
          if (info.status !== 'progress_total') return;
          const now = Date.now();
          if (info.progress < 100 && now - lastEmit < PROGRESS_THROTTLE_MS) return;
          lastEmit = now;
          onProgress?.({ phase: 'loading-model', percent: info.progress });
        }
      })
    );
  }
  return pipelinePromise;
}

// `samples` must already be mono Float32Array PCM at 16kHz — both callers
// arrange that themselves (decodeWavPcm / renderNeutralPcm16k) since how
// they get there differs.
export async function transcribePcm(
  samples: Float32Array,
  onProgress?: (p: TranscribeProgress) => void
): Promise<string> {
  const transcriber = await loadPipeline(onProgress);

  onProgress?.({ phase: 'transcribing' });
  const output = await transcriber(samples);
  const result = Array.isArray(output) ? output[0] : output;
  return (result?.text ?? '').trim();
}

// `wavBlob` must be the 16-bit PCM WAV voiceChanger.ts produces (16kHz mono)
// — decodeWavPcm reads it directly rather than through AudioContext so the
// sample rate Whisper sees is exactly the one already baked into the file.
export async function transcribeVoiceClip(
  wavBlob: Blob,
  onProgress?: (p: TranscribeProgress) => void
): Promise<string> {
  const { samples } = await decodeWavPcm(wavBlob);
  return transcribePcm(samples, onProgress);
}
