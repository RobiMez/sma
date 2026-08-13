# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is pnpm.

- `pnpm dev` — dev server at http://localhost:5340 (Vite plugin attaches a `/ws` WebSocket server, see below)
- `pnpm build` / `pnpm preview` — production build / preview at port 4173
- `pnpm start` — `node server.js`; run this (not `preview`) to exercise the WebSocket path against a production build, since `vite preview` doesn't attach one
- `pnpm check` — svelte-kit sync + svelte-check (type checking)
- `pnpm lint` — prettier --check + eslint
- `pnpm format` — prettier write (with svelte + tailwindcss plugins)
- `pnpm test:unit` — Vitest (matches `src/**/*.{test,spec}.{js,ts}`)
- `pnpm test:unit src/index.test.ts` — run a single unit test file; add `-t 'name'` to filter by test name
- `pnpm test:integration` — Playwright (tests in `tests/`; auto-builds and previews on port 4173)
- `pnpm test` — integration then unit

Requires a `.env` file (see `.env.example`): `SECRET_MONGO_URI` (MongoDB connection string) and `PUBLIC_PGP_PASSPHRASE` (passphrase applied to all generated PGP keys). Split-deploy only: `CORS_ORIGINS` (comma-separated allowlist for cross-origin `/api` calls) and `PUBLIC_API_BASE` (backend origin the frontend should call; empty means same-origin).

Use conventional commits (`feat(scope): ...`, `fix(scope): ...`, etc.).

## What this app is

S.M.A ("Send Messages Anonymously") — anonymous messaging with end-to-end PGP encryption. SvelteKit 2 + Svelte 5 (runes), TypeScript, Tailwind CSS 4, MongoDB via Mongoose, openpgp.js. The server only ever stores public keys and encrypted ciphertext; private keys never leave the browser.

## Architecture

### Identity model (client-side only)

An "identity" is a curve25519 PGP keypair generated in the browser (`src/lib/utils/pgp.ts`) and stored in localStorage (`src/lib/utils/localStorage.ts`):

- `keyPairs` — map of all identities keyed by `uniqueString`
- `loadedPair` — the currently active identity
- `uniqueString` (aka `rid`, room id) — 12-char base64url SHA-256 hash of `privateKey + publicKey` (`src/lib/utils/hashing.ts`)

On identity creation, only `{ pbKey, rid }` is POSTed to `/api/pgp`, which creates a `Listener` document. `getAllFromLS()` auto-generates a genesis identity if none exists, so first page load silently registers a listener.

### Message flow

- `/b/[room]` — public send page (the shareable link). Fetches the recipient's public key by `rid`, encrypts the message with it, and **signs with the sender's private key**, then PATCHes `/api/pgp` with `{ message, imageData, audioData, r: senderRid, p: recipientRid }`.
- `/li/[room]` — the owner's inbox. Only "unlocks" if the loaded keypair hashes to the room's `rid`. Opens a WebSocket (`/ws?rid=<rid>`) and, while it's connected, relies on the server's push ping instead of polling; on connect failure or drop it falls back to polling `GET /api/pgp?r=<rid>` on a timer with backoff and keeps retrying the socket. Each fetched message is decrypted and its **signature verified against the claimed author's public key** (fetched by the `author` rid and cached). Unsigned or mismatched-signature messages are skipped as spoofs — preserve this check when touching decryption.
- `/i` — manage/switch identities.
- `/` — home; links to `/i` and to `/li/<loadedPair.uniqueString>`.

Profanity checking happens client-side against the external `https://vector.profanity.dev` API before sending, but only when the recipient's listener has `profanityEnabled: false` (the flag means "profanity allowed" is toggled per listener via `/api/profanity`). This is honor-system, not enforced server-side: the server never sees plaintext (voice notes and, as of this check, message text alike), so a modified client can trivially skip it. Voice notes go through the identical check (see below) — there's no separate policy for audio.

### Voice messages (disguise-then-encrypt, unlike images)

`src/lib/utils/voiceChanger.ts` turns a `MediaRecorder` clip into a disguised mono 16kHz WAV entirely in the browser, before it's ever encrypted or sent — the same "never leaves the browser raw" rule the PGP identity follows. It's dependency-free on purpose: every preset starts from a pitch shift via `AudioBufferSourceNode.playbackRate` inside an `OfflineAudioContext` (the classic chipmunk/deep-voice trick — pitch and cadence shift together, which is actually more disguising than pitch alone), and layers additional standard Web Audio stages on top per the `STAGES` table — ring modulation (Robot, Alien, Monster), a telephone-band filter (Radio), waveshaper distortion (Radio, Monster). Adding a preset is a `STAGES` entry, not new plumbing. `VoiceRecorder.svelte` (next to `/b/[room]`) owns recording + the preset picker (`VOICE_PRESETS`) and hands the parent page a plain `Blob`.

Text is no longer mandatory on `/b/[room]` — a voice note or image is a complete message by itself (`hasContent` gates the Send button; the server's matching check lives in `PATCH /api/pgp`, after image/audio are parsed, not the old bare `!message` check that blocked voice-only sends).

Unlike images (see below), voice notes get the **full text-message treatment**: `/b/[room]` PGP-encrypts and signs the WAV bytes (`openpgp.createMessage({ binary: ... })`) the same way it does the text, chunks the armored output with `breakString` into `audioData.dataURI`, and the inbox only ever plays a clip after decrypting and verifying its signature against the claimed author — an unsigned or mismatched-signature clip is treated as a spoof and refused, exactly like text. This is intentionally stricter than the image path because a voice sample is far more identifying than an attached photo.

Storage/transport mirrors the image pattern for scale reasons even though the content isn't images: an `Audio` model (`src/models/audio.schema.ts`, referenced by `Message.audio`) holds the chunked ciphertext; `GET /api/pgp` excludes it from the inbox-list populate (`select: '-dataURI'`, same as `Image`) so polling doesn't balloon, and `/api/audio?id=...` lazily serves the full ciphertext, fetched and decrypted only when the recipient taps play (`VoiceMessage.svelte`, mirrors `BlurhashThumbnail.svelte`'s lazy-fetch-on-open pattern). The decrypt/verify logic itself lives in `/li/[room]/+page.svelte` as a `decryptAudio` callback threaded through `Message.svelte`, reusing the same cached private key and author-key cache the text path already built — don't duplicate that logic in the leaf component.

**Transcription** (`src/lib/utils/transcribe.ts`) is recipient-side only, on-demand, and fully on-device — same rule as the disguise step: nothing is uploaded to transcribe. It dynamic-`import()`s `@huggingface/transformers` (a small English Whisper checkpoint, `Xenova/whisper-tiny.en`) only when the recipient presses "Transcribe" in `VoiceMessage.svelte`, so it's not part of the normal bundle; the browser caches the model weights after the first download (transformers.js's own Cache Storage use), so it isn't re-fetched on later transcriptions or page loads. It feeds the model raw PCM read directly out of the WAV `voiceChanger.ts` already produced (`decodeWavPcm`, the inverse of `encodeWav`) rather than round-tripping through `AudioContext.decodeAudioData`, specifically to avoid that API silently resampling to whatever rate the context happens to pick — the WAV's rate is already the 16kHz Whisper wants.

`dtype: 'q8'` on the `pipeline()` call is load-bearing, not a nice-to-have — measured directly (see git history / PR discussion): this model's default (fp32) weights are ~144MB; `q8` is ~39MB for the same model and is the accuracy/size sweet spot (a `q4` variant exists but its decoder is actually *larger* than q8's here, and less accurate — quantization gains aren't monotonic per-model, don't assume a smaller dtype name means a smaller file without checking). The library is theoretically supposed to default to q8 on its own on a wasm backend, but only if its device auto-detection resolves to exactly `"wasm"` — leaving `dtype` unset risks silently downloading the 144MB fp32 weights instead, which reads as "transcription doesn't work" on a real connection rather than "transcription is slow". Always pass `dtype` explicitly; don't rely on the library's implicit default. Relatedly, `progress_callback` fires once per HTTP chunk (hundreds of times for one file) — `loadPipeline` throttles it to ~8/sec before it reaches Svelte state, since driving `$state` that often is pure jank.

`session_options: { graphOptimizationLevel: 'disabled' }` on the same call works around a real bug, not a defensive default: this exact model+dtype loads fine under `onnxruntime-node` (confirmed outside the browser) but threw in-browser — `Can't create a session... qdq_actions.cc:137 TransposeDQWeightsForMatMulNBits Missing required scale` for the decoder's tied `embed_tokens` weight. The `.onnx` file itself only contains plain `QuantizeLinear`/`DequantizeLinear` ops (checked via `strings` on the binary — no `MatMulNBits`, and the "missing" scale initializer is right there in the file); the crash is onnxruntime-web's own optimizer trying to *fuse* that pattern into a `MatMulNBits` op at load time and failing on this weight-transpose shape — `TransposeDQWeightsForMatMulNBits` is an ORT transform name, not anything of ours. `@huggingface/transformers` pins a dev/nightly `onnxruntime-web` build (not a stable release) across every version checked (3.x–4.2.0), so downgrading the package doesn't dodge it. Couldn't verify the fix against a real browser from an agent sandbox (no browser available), so this went with the conservative option (`'disabled'`, not just dropping below whichever level the fusion actually lives at) — if a future `@huggingface/transformers` ships a fixed `onnxruntime-web`, it's worth trying `'basic'` or `'all'` again for any perf back.

**Voice moderation** reuses transcription rather than being a separate system: since voice notes are E2E encrypted like text, the server structurally cannot inspect them, so — same as text — moderation can only happen client-side, on the sender, before encryption. `/b/[room]`'s `signMessage()` transcribes the recording locally via `transcribe.ts`'s `transcribePcm` (a second entry point alongside `transcribeVoiceClip`, factored out so both callers share the model-loading logic) and runs the result through the exact same `checkProfanity()` call the typed text already goes through — skipped if the text already failed, so the model doesn't load needlessly. Critically, it transcribes `VoiceRecorder.svelte`'s `getNeutralPcm()` — the **pre-disguise** recording via `renderNeutralPcm16k` in `voiceChanger.ts` — not the pitch-shifted/ring-modulated clip that actually gets sent; Whisper wasn't trained on robot voices, so transcribing the disguised version would wreck accuracy. The check is explicitly fail-open: if the local model fails to load or run (offline, unsupported browser, a bad first-download), the error is logged and the send proceeds rather than making voice messages unsendable whenever the ML pipeline has a bad day — this is best-effort moderation, not a hard security gate, matching the honor-system nature of the text check it reuses.

### Authenticating owner-only mutations

The `rid` is public (it is the share link), so it can never authorize anything by itself. Owner-only mutations — setting the room title, toggling the profanity flag, reading/writing the webhook — are authorized by a **PGP signature**, not by the rid:

- Client: `signedFetch(url, method, rid, action, params)` in `src/lib/utils/signedRequest.ts` signs `{ action, rid, ts, params }` with the room's private key (looked up from localStorage by rid) and POSTs `{ rid, signed }`.
- Server: `verifySignedAction(body, expectedAction)` in `src/lib/server/signedAction.ts` verifies the signature against the listener's stored `pbKey`, checks the action and rid match, and rejects payloads older than 5 minutes (replay window). Endpoints read their inputs from the returned signed `params`, never from unsigned request fields.

When adding a new owner-only endpoint, gate it with `verifySignedAction` and call it from the client with `signedFetch` — do not trust a plain rid. Public reads (title, profanity flag for senders) stay unsigned GETs. User-supplied webhook URLs must pass `isSafeWebhookUrl` (`src/lib/server/webhookGuard.ts`) both on save and again at fire time (SSRF guard). Unit tests for the auth and SSRF logic live in `src/lib/server/*.test.ts`.

`POST /api/pgp` (listener registration) rejects duplicate rids (409) and validates the armored `pbKey`; `rid` is a unique index on the `Listener` schema. The message-send `PATCH /api/pgp` type-checks and size-caps all fields so unvalidated objects can't reach Mongoose queries (NoSQL injection).

### Two deploy targets + WebSocket live updates

The app ships two ways from the same repo, chosen by `svelte.config.js` at build time (`process.env.VERCEL` set → `adapterVercel()`, otherwise `adapterNode()`):

- **Self-hosted box** (`deploy/sma.service` + `deploy/nginx-sma.conf`): builds with adapter-node, then runs via `server.js`, a thin wrapper that puts SvelteKit's `build/handler.js` and a `ws` `WebSocketServer` behind one `http.Server`, routing `/ws` upgrades to the socket server and everything else to the SvelteKit handler. Nginx proxies both to it and keeps the WS upgrade headers.
- **Vercel frontend**: builds with adapter-vercel (no long-lived process, so no WebSocket support). It's configured with `PUBLIC_API_BASE` pointing at the box, so `apiUrl()`/`wsUrl()` (`src/lib/api.ts`) send its `fetch`/WebSocket calls cross-origin to the box instead of Vercel's own bundled routes — otherwise it'd hit a second, divergent database. `hooks.server.ts` answers the resulting CORS preflights and echoes an allowed origin per `CORS_ORIGINS`.
- In dev, `vite.config.ts` registers a Vite plugin that attaches the same `/ws` handling to Vite's dev server, mirroring `server.js`.
- Both the standalone server and the Vite plugin subscribe/notify through `src/lib/server/wsRegistry.js`, a registry deliberately stored on `globalThis` (not a module-level `Map`) because the bundled SvelteKit handler and the outer server are separate module graphs and would otherwise each get their own instance. `notifyRoom(rid)` is called after a message is stored (`POST`-adjacent in `/api/pgp`) and just pings subscribers to refetch — the socket never carries message content. This is single-process, like the rate limiter and DB connection below; a multi-instance deploy would need a broker (e.g. Redis pub/sub) instead.

### Server side

- `src/hooks.server.ts` calls `dbConnect()` (`src/lib/db.ts`) once at module load; connection is cached. It also applies per-IP rate limiting (`src/lib/server/rateLimit.ts`) to `/api/*`: separate per-minute budgets for message send (`PATCH /api/pgp`, 30), registration (`POST /api/pgp`, 10), signed mutations (30), and a broad backstop (240) that polling stays well under. Over-budget requests get a real `429` + `Retry-After`. The limiter is in-process, so it assumes a single long-lived Node server (same assumption as the cached DB connection and the WS registry) — a multi-instance deploy would need a shared store.
- Models in `src/models/` use the `mongoose.models.X || mongoose.model(...)` pattern to survive HMR. `Listener` (pbKey, rid, title, webhookUrl, profanityEnabled, message refs) is the recipient/room document; `Message` holds armored ciphertext + `author` (sender rid) + optional `Image` ref. **`room.schema.ts` is unused legacy — `Listener` is the real model.** `src/controllers/message.controller.ts` is likewise an empty, unused file.
- API routes in `src/routes/api/`: `pgp` (GET inbox, PATCH send, POST register), `images` (GET by id), `audio` (GET by id, ciphertext only), `profanity`, `title`, `webhook` (per-listener webhook fired on new messages), `stats` (public, CORS-open aggregates).
- API responses always return HTTP 200 with the real status embedded in the JSON payload as `{ status, body }`. **There is no `.error` or `.message` field, ever** — clients must check `resp.status !== 200`, not `resp.error`. A real, previously-shipped bug: several call sites across the client (`/b/[room]`, `/i`, `BlurhashThumbnail.svelte`, `Stats.svelte`, the inbox poll) checked `resp.error`, which is always `undefined`/falsy, so every failure response silently fell through to the "success" branch — most seriously in `ResetPgpIdentity` (`src/lib/utils/pgp.ts`), where a failed registration (e.g. the DB unreachable) was saved to localStorage as if it had succeeded, producing an identity the server has no record of that then fails, confusingly, everywhere it's used later. Fixed at every call site found via `grep -rn '\.error\b' src/`, but if you add a new fetch-and-check, grep for that pattern before copying an existing one — several of the "correct-looking" examples elsewhere (`ListenerHeaderTitle.svelte`, `ProfanityToggle.svelte`, `WebhookSettings.svelte`) only work because they additionally check `.status`, with the dead `.error ||` left in front as vestigial.
- Images: stored as dataURI + blurhash on an `Image` doc, **not encrypted** — only the text (and, as of voice messages, audio) is PGP'd. `GET /api/pgp` excludes `dataURI` from the populate (`select: '-dataURI'`); full image data is fetched lazily via `/api/images?id=...`. Thumbnails render the blurhash first.

### Frontend conventions

- Svelte 5 runes (`$state`, `$props`, `$derived`) — not legacy `export let` / `$:` syntax.
- `src/lib/components/ui/` holds shadcn-svelte-style primitives built on bits-ui (badge, button, dialog, etc.) with `tailwind-variants` + the `cn()` helper from `src/lib/utils.ts`. Icons come from `phosphor-svelte` (imported per-icon, e.g. `phosphor-svelte/lib/Spinner`; excluded from Vite optimizeDeps).
- Route-specific components live next to their route (e.g. `src/routes/li/[room]/Message/`, `.../Modals/SettingsModal/`), not in `$lib`.
- localStorage access must be guarded with `typeof window === 'undefined'` checks (SSR).
- `Message.svelte`'s "save as image" dialog (`domToPng` from `modern-screenshot`) renders its own **second, independent** `BlurhashThumbnail` instance for the static preview — a deliberate duplicate of the one in the live message row, not a shared reference — which kicks off its own `/api/images` fetch on mount. `downloadImage`/`copyToClipboard` `await waitForImagesToLoad(messageElement)` before capturing for exactly this reason: capturing before that fetch resolves gets a blank image in the exported PNG, because `domToPng` snapshots whatever's in the DOM *right now*, it doesn't wait for async content on its own.
