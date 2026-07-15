# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is pnpm.

- `pnpm dev` — dev server at http://localhost:5340
- `pnpm build` / `pnpm preview` — production build / preview at port 4173
- `pnpm check` — svelte-kit sync + svelte-check (type checking)
- `pnpm lint` — prettier --check + eslint
- `pnpm format` — prettier write (with svelte + tailwindcss plugins)
- `pnpm test:unit` — Vitest (matches `src/**/*.{test,spec}.{js,ts}`)
- `pnpm test:unit src/index.test.ts` — run a single unit test file; add `-t 'name'` to filter by test name
- `pnpm test:integration` — Playwright (tests in `tests/`; auto-builds and previews on port 4173)
- `pnpm test` — integration then unit

Requires a `.env` file (see `.env.example`): `SECRET_MONGO_URI` (MongoDB connection string) and `PUBLIC_PGP_PASSPHRASE` (passphrase applied to all generated PGP keys).

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

- `/b/[room]` — public send page (the shareable link). Fetches the recipient's public key by `rid`, encrypts the message with it, and **signs with the sender's private key**, then PATCHes `/api/pgp` with `{ message, imageData, r: senderRid, p: recipientRid }`.
- `/li/[room]` — the owner's inbox. Only "unlocks" if the loaded keypair hashes to the room's `rid`. Polls `GET /api/pgp?r=<rid>` on an interval, decrypts each message, and **verifies the signature against the claimed author's public key** (fetched by the `author` rid and cached). Unsigned or mismatched-signature messages are skipped as spoofs — preserve this check when touching decryption.
- `/i` — manage/switch identities.
- `/` — home; links to `/i` and to `/li/<loadedPair.uniqueString>`.

Profanity checking happens client-side against the external `https://vector.profanity.dev` API before sending, but only when the recipient's listener has `profanityEnabled: false` (the flag means "profanity allowed" is toggled per listener via `/api/profanity`).

### Authenticating owner-only mutations

The `rid` is public (it is the share link), so it can never authorize anything by itself. Owner-only mutations — setting the room title, toggling the profanity flag, reading/writing the webhook — are authorized by a **PGP signature**, not by the rid:

- Client: `signedFetch(url, method, rid, action, params)` in `src/lib/utils/signedRequest.ts` signs `{ action, rid, ts, params }` with the room's private key (looked up from localStorage by rid) and POSTs `{ rid, signed }`.
- Server: `verifySignedAction(body, expectedAction)` in `src/lib/server/signedAction.ts` verifies the signature against the listener's stored `pbKey`, checks the action and rid match, and rejects payloads older than 5 minutes (replay window). Endpoints read their inputs from the returned signed `params`, never from unsigned request fields.

When adding a new owner-only endpoint, gate it with `verifySignedAction` and call it from the client with `signedFetch` — do not trust a plain rid. Public reads (title, profanity flag for senders) stay unsigned GETs. User-supplied webhook URLs must pass `isSafeWebhookUrl` (`src/lib/server/webhookGuard.ts`) both on save and again at fire time (SSRF guard). Unit tests for the auth and SSRF logic live in `src/lib/server/*.test.ts`.

`POST /api/pgp` (listener registration) rejects duplicate rids (409) and validates the armored `pbKey`; `rid` is a unique index on the `Listener` schema. The message-send `PATCH /api/pgp` type-checks and size-caps all fields so unvalidated objects can't reach Mongoose queries (NoSQL injection).

### Server side

- `src/hooks.server.ts` calls `dbConnect()` (`src/lib/db.ts`) once at module load; connection is cached. It also applies per-IP rate limiting (`src/lib/server/rateLimit.ts`) to `/api/*`: separate per-minute budgets for message send (`PATCH /api/pgp`, 30), registration (`POST /api/pgp`, 10), signed mutations (30), and a broad backstop (240) that polling stays well under. Over-budget requests get a real `429` + `Retry-After`. The limiter is in-process, so it assumes a single long-lived Node server (same assumption as the cached DB connection) — a multi-instance deploy would need a shared store.
- Models in `src/models/` use the `mongoose.models.X || mongoose.model(...)` pattern to survive HMR. `Listener` (pbKey, rid, title, webhookUrl, profanityEnabled, message refs) is the recipient/room document; `Message` holds armored ciphertext + `author` (sender rid) + optional `Image` ref. **`room.schema.ts` is unused legacy — `Listener` is the real model.**
- API routes in `src/routes/api/`: `pgp` (GET inbox, PATCH send, POST register), `images` (GET by id), `profanity`, `title`, `webhook` (per-listener webhook fired on new messages), `stats` (public, CORS-open aggregates).
- API responses always return HTTP 200 with the real status embedded in the JSON payload as `{ status, body }` — clients check `resp.body` / `resp.error`, not the HTTP status code.
- Images: stored as dataURI + blurhash on an `Image` doc. `GET /api/pgp` excludes `dataURI` from the populate (`select: '-dataURI'`); full image data is fetched lazily via `/api/images?id=...`. Thumbnails render the blurhash first.

### Frontend conventions

- Svelte 5 runes (`$state`, `$props`, `$derived`) — not legacy `export let` / `$:` syntax.
- `src/lib/components/ui/` holds shadcn-svelte-style primitives built on bits-ui (badge, button, dialog, etc.) with `tailwind-variants` + the `cn()` helper from `src/lib/utils.ts`. Icons come from `phosphor-svelte` (imported per-icon, e.g. `phosphor-svelte/lib/Spinner`; excluded from Vite optimizeDeps).
- Route-specific components live next to their route (e.g. `src/routes/li/[room]/Message/`, `.../Modals/SettingsModal/`), not in `$lib`.
- localStorage access must be guarded with `typeof window === 'undefined'` checks (SSR).
