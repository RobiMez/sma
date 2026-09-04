// Per-room abuse limits: shape validation for the owner's `limits:set`
// mutation and the gate every incoming send has to pass. Pure logic here so
// it can be unit-tested without a database (same reason messageEdit/
// messageReply live where they do).
//
// The four knobs, and who enforces each:
// - paused           — server, hard. Every send to the room is 403'd.
// - imagesEnabled    — server, hard. The server can't read ciphertext but it
//                      can plainly see an image is attached (same reasoning
//                      as voiceEnabled).
// - maxMessageLength — client exactly, server approximately. The server only
//                      ever sees armored ciphertext, so it can't count
//                      plaintext chars; what it CAN do is bound the ciphertext
//                      at a size no compliant message could reach (see
//                      ciphertextCapFor). Honest clients enforce the exact
//                      limit; the cap stops the 16KB-when-you-asked-for-280
//                      kind of abuse, not a 281st character.
// - rateLimitCount / rateLimitPeriod — server, hard, via an in-memory fixed
//                      window keyed by the RECIPIENT rid: at most `count`
//                      messages per minute/hour/day. Keying on the room (not
//                      the sender) is the point: sender identities are free
//                      to mint (Sybil), the room being flooded is not.

import { RateLimiter, type RateLimitResult } from './rateLimit';

// Matches the client composer's hardcoded maxlength — an owner cap above it
// would be meaningless.
export const MAX_MESSAGE_LENGTH_CEILING = 1000;
export const MAX_RATE_LIMIT_COUNT = 10_000;

// The window sizes an owner can pick for the room cap. Adding one here is the
// whole change — validation, storage and enforcement all key off this table.
export const RATE_PERIODS = {
  minute: 60 * 1000,
  hour: 60 * 60 * 1000,
  day: 24 * 60 * 60 * 1000
} as const;
export type RatePeriod = keyof typeof RATE_PERIODS;
export const DEFAULT_RATE_PERIOD: RatePeriod = 'hour';

export interface RoomLimits {
  paused?: boolean;
  imagesEnabled?: boolean;
  voiceEnabled?: boolean;
  maxMessageLength?: number;
  rateLimitCount?: number;
  rateLimitPeriod?: string;
}

type Verdict = { ok: true } | { ok: false; status: number; message: string };
type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

export type LimitsUpdate = Pick<
  RoomLimits,
  'paused' | 'imagesEnabled' | 'maxMessageLength' | 'rateLimitCount' | 'rateLimitPeriod'
>;

/**
 * Ciphertext size no compliant message of `maxLen` plaintext chars can exceed.
 * Worst case per char is a 4-byte code point (emoji): 4 bytes × 4/3 base64
 * × line-wrapping overhead ≈ 5.6 armored chars, so 6/char is safe. The
 * constant covers armor headers, two PKESK packets (encrypt-to-self), the
 * signature and the literal-packet framing — measured ~1.3KB, doubled for
 * headroom. Verified empirically against openpgp in roomLimits.test.ts.
 */
export function ciphertextCapFor(maxLen: number): number {
  return 2600 + 6 * maxLen;
}

/**
 * Validates the signed params of a `limits:set` request. Partial on purpose:
 * each settings control updates only its own field, so absent keys mean
 * "leave alone", and anything present is attacker-shaped until proven a
 * sane literal (numbers via Number.isInteger so `{ $gt: 0 }` and 1e300 both
 * die here, before Mongoose).
 */
export function parseLimitsParams(params: Record<string, unknown>): Parsed<LimitsUpdate> {
  const value: LimitsUpdate = {};

  if ('paused' in params) {
    if (typeof params.paused !== 'boolean') {
      return { ok: false, status: 400, message: 'Invalid paused value' };
    }
    value.paused = params.paused;
  }
  if ('imagesEnabled' in params) {
    if (typeof params.imagesEnabled !== 'boolean') {
      return { ok: false, status: 400, message: 'Invalid imagesEnabled value' };
    }
    value.imagesEnabled = params.imagesEnabled;
  }
  if ('maxMessageLength' in params) {
    const n = params.maxMessageLength;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_MESSAGE_LENGTH_CEILING) {
      return { ok: false, status: 400, message: 'Invalid maxMessageLength value' };
    }
    value.maxMessageLength = n;
  }
  if ('rateLimitCount' in params) {
    const n = params.rateLimitCount;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 0 || n > MAX_RATE_LIMIT_COUNT) {
      return { ok: false, status: 400, message: 'Invalid rateLimitCount value' };
    }
    value.rateLimitCount = n;
  }
  if ('rateLimitPeriod' in params) {
    const p = params.rateLimitPeriod;
    // hasOwn, not `in`: 'toString' is `in` every object via the prototype.
    if (typeof p !== 'string' || !Object.hasOwn(RATE_PERIODS, p)) {
      return { ok: false, status: 400, message: 'Invalid rateLimitPeriod value' };
    }
    value.rateLimitPeriod = p;
  }

  if (Object.keys(value).length === 0) {
    return { ok: false, status: 400, message: 'No limit settings supplied' };
  }
  return { ok: true, value };
}

export interface SendShape {
  hasImage: boolean;
  hasAudio: boolean;
  /** Length of the armored message ciphertext (not plaintext — see above). */
  ciphertextLength: number;
}

/**
 * The per-room gate a send must pass, checked before anything is written.
 * Flag comparisons are deliberately asymmetric about `undefined` (a doc
 * predating the field): images/paused only act on an explicit value because
 * their defaults are permissive, while voice stays opt-in — anything short of
 * an explicit `true` refuses audio, mirroring the check this replaces.
 */
export function checkSendGate(listener: RoomLimits, send: SendShape): Verdict {
  if (listener.paused === true) {
    return { ok: false, status: 403, message: 'This room is paused and not accepting messages' };
  }
  if (send.hasImage && listener.imagesEnabled === false) {
    return { ok: false, status: 403, message: 'This room does not accept images' };
  }
  if (send.hasAudio && listener.voiceEnabled !== true) {
    return { ok: false, status: 403, message: 'This room does not accept voice messages' };
  }
  const maxLen = listener.maxMessageLength ?? 0;
  if (maxLen > 0 && send.ciphertextLength > ciphertextCapFor(maxLen)) {
    return {
      ok: false,
      status: 403,
      message: `This room caps messages at ${maxLen} characters`
    };
  }
  return { ok: true };
}

// Same single-process caveat as the per-IP limiter: state lives here, so a
// multi-instance deploy needs a shared store. A restart forgets the window,
// which for an hourly abuse cap is an acceptable failure mode.
const roomSendLimiter = new RateLimiter();

/**
 * Counts this send against the room's rate window. Call it LAST, once every
 * other check has passed — checking increments the window, and a send that
 * was going to be rejected anyway shouldn't eat the room's budget.
 * Returns null when the room has no cap. The period is part of the key, so
 * an owner switching periods starts a fresh window instead of inheriting a
 * differently-sized one mid-flight; an unknown stored period falls back to
 * the hourly default rather than failing open.
 */
export function checkRoomRate(
  rid: string,
  count: number | undefined,
  period: string | undefined,
  now: number = Date.now()
): RateLimitResult | null {
  const limit = count ?? 0;
  if (limit <= 0) return null;
  const key: RatePeriod =
    period && Object.hasOwn(RATE_PERIODS, period) ? (period as RatePeriod) : DEFAULT_RATE_PERIOD;
  return roomSendLimiter.check(`room-send:${rid}:${key}`, limit, RATE_PERIODS[key], now);
}
