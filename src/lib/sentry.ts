/**
 * Shared Sentry scrubbing, applied identically on the client and the server.
 *
 * Error reporting is an awkward fit for this app: the entire point is that the
 * server only ever holds ciphertext, so anything that ships browser state to a
 * third party can undo the guarantee the product is built on. Two rules follow
 * from that, and neither is optional:
 *
 * 1. Session Replay is never enabled. It records the DOM, and on /li/[room]
 *    the DOM holds messages that have already been decrypted — it would send
 *    Sentry the plaintext the server deliberately never sees. See hooks.client.
 * 2. Everything that does get sent goes through `scrubEvent` first.
 *
 * What gets removed:
 *
 * - **PGP blocks.** openpgp.js quotes its input in error messages, so a failed
 *   `readMessage`/`decrypt` can carry an armored block — ciphertext, or worse,
 *   a private key — straight into the exception text.
 * - **Room ids.** An rid is the share link. It is not a secret, but it is the
 *   name of a room, and a URL is attached to every event: left alone, Sentry
 *   would accumulate a browsable index of who has a room and when they read
 *   it. Route *patterns* (`/li/[room]`) are kept — they're what makes the
 *   grouping useful and they name nobody.
 */

const PGP_BLOCK = /-----BEGIN PGP[\s\S]*?-----END PGP[^-]*-----/g;

// An rid is exactly 12 base64url chars (see utils/hashing.ts). Anchoring on
// the length and on a following path/query boundary keeps this from eating
// unrelated path segments such as hashed asset filenames.
const RID_IN_PATH = /\/(li|b)\/[A-Za-z0-9_-]{12}(?=$|[/?#])/g;
const RID_IN_QUERY = /\b(r|rid|p|id)=[A-Za-z0-9_-]{12,}/g;

export const PGP_PLACEHOLDER = '[pgp-block-redacted]';
export const RID_PLACEHOLDER = '[rid]';

/** Strip armored PGP and room ids out of a single string. */
export function scrubString(value: string): string {
  return value
    .replace(PGP_BLOCK, PGP_PLACEHOLDER)
    .replace(RID_IN_PATH, (_m, route) => `/${route}/${RID_PLACEHOLDER}`)
    .replace(RID_IN_QUERY, (_m, key) => `${key}=${RID_PLACEHOLDER}`);
}

/**
 * Walk an arbitrary Sentry event and scrub every string in it.
 *
 * Deliberately a blanket walk rather than a list of known fields: the SDK adds
 * new places for strings to hide (breadcrumbs, request data, span attributes,
 * contexts) faster than a hand-maintained allowlist would keep up with, and
 * the failure mode of missing one is leaking plaintext.
 */
export function scrubDeep<T>(value: T, depth = 0): T {
  if (depth > 12) return value;
  if (typeof value === 'string') return scrubString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, depth + 1)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubDeep(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

/** `beforeSend`/`beforeSendTransaction` hook. */
export function scrubEvent<T>(event: T): T {
  return scrubDeep(event);
}

/**
 * Options shared by both runtimes. `sendDefaultPii` stays false so the SDK
 * doesn't attach IPs or request bodies — a message body here is ciphertext the
 * server is not supposed to be accumulating copies of.
 */
export const sharedSentryOptions = {
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent
};
