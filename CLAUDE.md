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

- `/b/[room]` — public send page (the shareable link). Fetches the recipient's public key by `rid`, encrypts the message to **both that key and the sender's own** (see "Editing sent messages" below), and **signs with the sender's private key**, then PATCHes `/api/pgp` with `{ message, imageData, audioData, r: senderRid, p: recipientRid }`. Below the composer it also lists what this identity has already sent to this room, with an inline editor and any replies the room owner wrote back.
- `/li/[room]` — the owner's inbox. Only "unlocks" if the loaded keypair hashes to the room's `rid`. Opens a WebSocket (`/ws?rid=<rid>`) and, while it's connected, relies on the server's push ping instead of polling; on connect failure or drop it falls back to polling `GET /api/pgp?r=<rid>` on a timer with backoff and keeps retrying the socket. Each fetched message is decrypted and its **signature verified against the claimed author's public key** (fetched by the `author` rid and cached). Unsigned or mismatched-signature messages are skipped as spoofs — preserve this check when touching decryption. The per-id decrypt cache is keyed on `(id, editedAt, repliedAt)` via `revisionOf()`, not id alone, because messages are no longer immutable — see below.
- `/i` — manage/switch identities.
- `/` — home; links to `/i` and to `/li/<loadedPair.uniqueString>`.

Profanity checking happens client-side against the external `https://vector.profanity.dev` API before sending, but only when the recipient's listener has `profanityEnabled: false` (the flag means "profanity allowed" is toggled per listener via `/api/profanity`). This is honor-system, not enforced server-side: the server never sees plaintext, so a modified client can trivially skip it. It covers **typed text only** — voice notes and images are never inspected (see the voice section below for why transcription-based moderation was removed).

### Editing sent messages (and why the sender can read them back)

A sender sees their own history under the composer on `/b/[room]` (`SentMessages.svelte`) and can rewrite the text of anything they sent there.

The precondition is **encrypt-to-self**: `/b/[room]` passes `encryptionKeys: [recipientKey, senderKey]` (skipping the second when they're the same key, i.e. sending to your own room). PGP just adds a second session-key packet — the recipient's copy is bit-for-bit as usable as before — but without it the sender holds ciphertext only the recipient can open, and "show me what I sent" is impossible without storing plaintext somewhere, which this app never does. **Messages sent before this existed can't be shown**: the list renders them as a locked row rather than pretending, and they can't be edited (an edit would overwrite text nobody on the sender's side can read).

Both endpoints live in `/api/sent` and both are **signature-authorized**, which is the same `verifySignedAction` machinery as the owner-only settings — the generalization being that a signature proves control of *an* rid, not specifically a room owner's:

- `POST` (`sent:list`) — a read behind POST, because the signature travels in the body (`signedFetch`). It can't be a public GET: the rid is in the share link, so a GET would let anyone enumerate who writes to a room and how often. The ciphertext would stay opaque, but the metadata wouldn't.
- `PATCH` (`message:edit`) — swaps `Message.message` for new ciphertext the client built exactly like a first send (encrypted to both, signed by the author) and stamps `editedAt`. The server checks `message.author === <verified rid>` and that the message really belongs to the room the client named; the id is validated as a literal ObjectId before it reaches Mongoose. Shape and authorization rules are `src/lib/server/messageEdit.ts`, unit-tested without a DB.

Three consequences worth knowing before touching this:

- **`timestamp` never moves on an edit.** It's the inbox's poll cursor and sort key; bumping it would reorder the inbox and re-fire the new-message sound. `GET /api/pgp`'s incremental `match` therefore ORs `editedAt >= since` alongside `timestamp >= since` — without that arm, an edit to anything older than the client's cursor would never reach an already-open inbox. Replies later added a third arm, `repliedAt`, for exactly the same reason.
- **The inbox's decrypt cache had to stop assuming immutability.** It re-decrypts whenever a message's revision (`editedAt` + `repliedAt`, see `revisionOf()`) changes — the skipped/spoof set records the same string, so a rewritten message gets one retry — and the edit fires the same `notifyRoom` ping a new message does.
- **The recipient is told.** `Message.svelte` renders an "edited" marker; silently swapping text under someone would be a nastier primitive than the feature is worth.

Editing replaces text only — an attached image or voice note stays as sent. The new text goes through the same client-side profanity check a send does (shared with the send path in `src/lib/utils/profanity.ts`), except a hit shows an inline error instead of clearing the box, since throwing away an edit in progress is worse than throwing away an unsent draft.

### Replying (owner → sender, scoped to one message)

The room owner can answer one specific message from their inbox, and only the identity that sent it can read the answer. `POST /api/reply` (action `message:reply`), UI in `Message.svelte` (hover toolbar → thread below the bubble) and `SentMessages.svelte` (thread under each sent row).

Replies are **embedded on the `Message` document** (`replies: [{ message, timestamp }]`), not a collection of their own. A reply is only meaningful attached to one message — that scoping *is* the feature — and both readers already fetch the parent, so embedding costs no extra round trip.

This is the mirror image of editing, and the symmetry is the thing to hold onto:

|            | edit                  | reply                        |
| ---------- | --------------------- | ---------------------------- |
| authorized by | the **sender's** signature | the **room owner's** signature |
| server check  | `message.author === <verified rid>` | `room === <verified rid>` |
| effect        | rewrites `message`, stamps `editedAt` | appends to `replies`, stamps `repliedAt` |

Both ride the same `verifySignedAction`, which only ever proves "the caller controls this rid" — deciding *which* rid that must be is each endpoint's job. Rules live in `src/lib/server/messageReply.ts`, unit-tested without a DB. Note the ordering there: the owner check runs **before** the message is looked up, so a non-owner gets the same 403 whether or not the id they guessed exists — otherwise the endpoint is an oracle for "is this ObjectId a real message in your room".

Points that will bite if you change this:

- **Replies are encrypted to the sender *and* the owner, and signed by the owner.** Encrypt-to-self again, for the same reason as sends: without it the owner couldn't read back their own side of the thread. The signature is load-bearing in the other direction — `SentMessages.svelte` verifies each reply against the **room owner's** public key, which is what stops anyone who can write to the database (including the server) from planting a "reply from the room owner". Verifying our own signature on the inbox side isn't circular for the same reason.
- **The sender's page updates live.** Every identity is a registered `Listener`, so the sender's own rid already has a WebSocket room; `/api/reply` calls `notifyRoom(message.author)` as well as `notifyRoom(room)`. `SentMessages.svelte` subscribes to `/ws?rid=<own rid>` with a 20s poll fallback. That same ping also fires when someone messages the sender's *own* room, so refreshes are coalesced (`MIN_GAP_MS`) — `/api/sent` costs a server-side PGP verify and shares the 30/min signed-mutation budget.
- **A locked message can still be replied to.** Messages predating encrypt-to-self are unreadable by their sender, but a reply is encrypted fresh at reply time, so it lands readable underneath a row that shows "can't be shown".
- **`MAX_REPLIES_PER_MESSAGE` (50) is a document-size bound, not an abuse limit** — replies are owner-only. It matters because every inbox poll and every `/api/sent` listing carries the whole thread inline.
- Reply text is **not** profanity-checked: that filter exists to protect the room owner from what senders send them, and the owner is the one writing here.
- Replies are visible in the ciphertext returned by the public `GET /api/pgp?r=<rid>`, so "the owner replied to this message at T" leaks to anyone holding the share link — the same way message timestamps already do. The text itself stays opaque.

There is no edit or delete for a reply, and the sender cannot reply back — this is deliberately one message deep, not a chat.

### Voice messages (disguise-then-encrypt, unlike images)

Voice notes are **opt-in per room** (`Listener.voiceEnabled`, default `false`, so every pre-existing room reads as off). The toggle lives in the inbox Settings modal (`VoiceToggle.svelte`, mirroring `ProfanityToggle`) and is written through the signed-mutation path (`PATCH /api/voice`, action `voice:set`) like every other owner-only setting. `/b/[room]` reads the public `GET /api/voice?rid=` on mount and only renders `VoiceRecorder` when it comes back `true` — failing closed if the read fails. Unlike the profanity flag, this one is **actually enforced server-side**: `PATCH /api/pgp` rejects a send carrying `audioData` to a room with `voiceEnabled: false` with a 403, checked before the `Audio` doc is written. The server can enforce this precisely because it doesn't need to see plaintext to know an audio blob is attached — the opposite of why profanity can't be enforced.

`src/lib/utils/voiceChanger.ts` turns a `MediaRecorder` clip into a disguised mono 16kHz WAV entirely in the browser, before it's ever encrypted or sent — the same "never leaves the browser raw" rule the PGP identity follows. It's dependency-free on purpose: every preset starts from a pitch shift via `AudioBufferSourceNode.playbackRate` (the classic chipmunk/deep-voice trick — pitch and cadence shift together), and layers additional standard Web Audio stages on top per the `STAGES` table — ring modulation (Robot, Alien, Monster), a telephone-band filter (Radio), waveshaper distortion (Radio, Monster). Adding a preset is a `STAGES` entry, not new plumbing. `VoiceRecorder.svelte` (next to `/b/[room]`) owns recording + the preset picker (`VOICE_PRESETS`) and hands the parent page a plain `Blob`.

**Do not describe this as anonymising the speaker — it isn't, and saying so would mislead senders into disclosing more than they mean to.** The pitch shift is a plain resample, which is a linear, invertible operation: measured directly, taking a `deep` clip and resampling by 1/0.78 recovers the original pitch and duration to within 0.3% (140Hz → 108.8Hz → 140.4Hz). The six ratios are hardcoded in client code that ships to everyone, so an attacker doesn't even have to guess. Nor does it need inverting to fail: resampling scales F0, formants and cadence by one constant, leaving the vocal-tract ratio and prosody contour intact, and leaves accent, word choice, disfluencies and breathing completely untouched. The threat model makes it worse rather than better — the listener is the room owner, who shared their link with people who know them, and a familiar listener is exactly who a pitch shift fails against. Treat the presets as "makes you sound different", which is what they deliver. The genuinely irreversible parts are the 16kHz downsample and Radio's band-limiting, and those cost quality without removing identity.

Text is no longer mandatory on `/b/[room]` — a voice note or image is a complete message by itself (`hasContent` gates the Send button; the server's matching check lives in `PATCH /api/pgp`, after image/audio are parsed, not the old bare `!message` check that blocked voice-only sends).

Unlike images (see below), voice notes get the **full text-message treatment**: `/b/[room]` PGP-encrypts and signs the WAV bytes (`openpgp.createMessage({ binary: ... })`) the same way it does the text, chunks the armored output with `breakString` into `audioData.dataURI`, and the inbox only ever plays a clip after decrypting and verifying its signature against the claimed author — an unsigned or mismatched-signature clip is treated as a spoof and refused, exactly like text. This is intentionally stricter than the image path because a voice sample is far more identifying than an attached photo.

Storage/transport mirrors the image pattern for scale reasons even though the content isn't images: an `Audio` model (`src/models/audio.schema.ts`, referenced by `Message.audio`) holds the chunked ciphertext; `GET /api/pgp` excludes it from the inbox-list populate (`select: '-dataURI'`, same as `Image`) so polling doesn't balloon, and `/api/audio?id=...` lazily serves the full ciphertext, fetched and decrypted only when the recipient taps play (`VoiceMessage.svelte`, mirrors `BlurhashThumbnail.svelte`'s lazy-fetch-on-open pattern). The decrypt/verify logic itself lives in `/li/[room]/+page.svelte` as a `decryptAudio` callback threaded through `Message.svelte`, reusing the same cached private key and author-key cache the text path already built — don't duplicate that logic in the leaf component.

**No transcription.** An earlier iteration transcribed voice notes on-device (`@huggingface/transformers`, a small Whisper checkpoint) for two things: a recipient-side "Transcribe" button, and a sender-side moderation pass that fed the transcript to the same `checkProfanity()` call typed text uses. Both were removed deliberately. The dependency pulled ~450MB into `node_modules` (`onnxruntime-web`, plus an `onnxruntime-node` and `sharp` that never execute in the browser but kept surfacing their own CVEs) and cost the first user a ~39MB model download, in exchange for a feature the room owner can already decline wholesale — voice is opt-in per room, and the profanity filter is opt-out per room. Don't reintroduce it without weighing that trade again.

The consequence to be aware of: **voice notes are not moderated at all.** A room with the profanity filter on gets filtered text and unfiltered voice. That asymmetry is intentional — the check was honor-system, client-side and fail-open even when it existed, so it was never a real gate — but it does mean the only lever against unwanted voice is the per-room voice toggle. Images are likewise uninspected. Being voice-only also makes a message unreadable to a recipient who can't hear it; there's no transcript fallback.

### Authenticating owner-only mutations

The `rid` is public (it is the share link), so it can never authorize anything by itself. Owner-only mutations — setting the room title, toggling the profanity flag, reading/writing the webhook — are authorized by a **PGP signature**, not by the rid:

- Client: `signedFetch(url, method, rid, action, params)` in `src/lib/utils/signedRequest.ts` signs `{ action, rid, ts, params }` with the room's private key (looked up from localStorage by rid) and POSTs `{ rid, signed }`.
- Server: `verifySignedAction(body, expectedAction)` in `src/lib/server/signedAction.ts` verifies the signature against the listener's stored `pbKey`, checks the action and rid match, and rejects payloads older than 5 minutes (replay window). Endpoints read their inputs from the returned signed `params`, never from unsigned request fields.

The same machinery covers "prove you're this sender", not just "prove you own this room": `/api/sent` uses it with the *sender's* rid to list and edit their own messages (see "Editing sent messages"), while `/api/reply` uses it with the *room owner's* rid for the reverse direction (see "Replying"). What a signature establishes is control of an rid; who that rid is to a given endpoint is the endpoint's business, and it must be checked explicitly — `/api/reply` requiring `room === <verified rid>` is the only thing making it owner-only.

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
- Models in `src/models/` use the `mongoose.models.X || mongoose.model(...)` pattern to survive HMR. `Listener` (pbKey, rid, title, webhookUrl, profanityEnabled, message refs) is the recipient/room document; `Message` holds armored ciphertext + `author` (sender rid) + optional `Image`/`Audio` refs + an embedded `replies` array (see "Replying"). **`room.schema.ts` is unused legacy — `Listener` is the real model.** `src/controllers/message.controller.ts` is likewise an empty, unused file.
- API routes in `src/routes/api/`: `pgp` (GET inbox, PATCH send, POST register), `sent` (POST list-my-sent, PATCH edit — both signed, sender's rid), `reply` (POST owner reply to one message — signed, room owner's rid), `images` (GET by id), `audio` (GET by id, ciphertext only), `profanity`, `title`, `voice`, `webhook` (per-listener webhook fired on new messages), `stats` (public, CORS-open aggregates).
- API responses always return HTTP 200 with the real status embedded in the JSON payload as `{ status, body }`. **There is no `.error` or `.message` field, ever** — clients must check `resp.status !== 200`, not `resp.error`. A real, previously-shipped bug: several call sites across the client (`/b/[room]`, `/i`, `BlurhashThumbnail.svelte`, `Stats.svelte`, the inbox poll) checked `resp.error`, which is always `undefined`/falsy, so every failure response silently fell through to the "success" branch — most seriously in `ResetPgpIdentity` (`src/lib/utils/pgp.ts`), where a failed registration (e.g. the DB unreachable) was saved to localStorage as if it had succeeded, producing an identity the server has no record of that then fails, confusingly, everywhere it's used later. Fixed at every call site found via `grep -rn '\.error\b' src/`, but if you add a new fetch-and-check, grep for that pattern before copying an existing one — several of the "correct-looking" examples elsewhere (`ListenerHeaderTitle.svelte`, `ProfanityToggle.svelte`, `WebhookSettings.svelte`) only work because they additionally check `.status`, with the dead `.error ||` left in front as vestigial.
- Images: stored as dataURI + blurhash on an `Image` doc, **not encrypted** — only the text (and, as of voice messages, audio) is PGP'd. `GET /api/pgp` excludes `dataURI` from the populate (`select: '-dataURI'`); full image data is fetched lazily via `/api/images?id=...`. Thumbnails render the blurhash first.

### Frontend conventions

- Svelte 5 runes (`$state`, `$props`, `$derived`) — not legacy `export let` / `$:` syntax.
- `src/lib/components/ui/` holds shadcn-svelte-style primitives built on bits-ui (badge, button, dialog, etc.) with `tailwind-variants` + the `cn()` helper from `src/lib/utils.ts`. Icons come from `phosphor-svelte` (imported per-icon, e.g. `phosphor-svelte/lib/Spinner`; excluded from Vite optimizeDeps).
- Route-specific components live next to their route (e.g. `src/routes/li/[room]/Message/`, `.../Modals/SettingsModal/`), not in `$lib`.
- localStorage access must be guarded with `typeof window === 'undefined'` checks (SSR).
- `Message.svelte`'s "save as image" dialog (`domToPng` from `modern-screenshot`) renders its own **second, independent** `BlurhashThumbnail` instance for the static preview — a deliberate duplicate of the one in the live message row, not a shared reference — which kicks off its own `/api/images` fetch on mount. `downloadImage`/`copyToClipboard` `await waitForImagesToLoad(messageElement)` before capturing for exactly this reason: capturing before that fetch resolves gets a blank image in the exported PNG, because `domToPng` snapshots whatever's in the DOM *right now*, it doesn't wait for async content on its own.
  - **That wait must check the `src` attribute, not the property.** `BlurhashThumbnail` renders `<img src={imageBase64}>` starting from `''`, and an `<img>` with an empty src reports `complete === true` while its `src` **property** reads back as the *document URL* — so the obvious `!img.complete || !img.src` test says "already loaded" about precisely the image it exists to wait for, and the exported PNG came out without the thumbnail. `waitForImagesToLoad` therefore polls `getAttribute('src')` until the data URI is in place and only then waits for decode. Verified by delaying `/api/images` by 3s and capturing immediately: the thumbnail still lands in the PNG.
- `/li/[room]`'s message toolbar (hover-revealed on desktop, always visible on touch) is: reply, copy text, redact, save as image. Copy text is a plain `navigator.clipboard.writeText` of the already-decrypted `msg.msg`, disabled when the message has no text (voice- or image-only) — distinct from the dialog's "copy as image".
