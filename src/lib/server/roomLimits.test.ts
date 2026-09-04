import { describe, it, expect } from 'vitest';
import * as openpgp from 'openpgp';
import {
  parseLimitsParams,
  checkSendGate,
  checkRoomRate,
  ciphertextCapFor,
  MAX_MESSAGE_LENGTH_CEILING
} from './roomLimits';

const RID = 'room-rid-1234';

const TEXT_ONLY = { hasImage: false, hasAudio: false, ciphertextLength: 500 };

describe('parseLimitsParams', () => {
  it('accepts a full, well-formed update', () => {
    const result = parseLimitsParams({
      paused: true,
      imagesEnabled: false,
      maxMessageLength: 280,
      rateLimitCount: 30,
      rateLimitPeriod: 'day'
    });
    expect(result).toMatchObject({
      ok: true,
      value: {
        paused: true,
        imagesEnabled: false,
        maxMessageLength: 280,
        rateLimitCount: 30,
        rateLimitPeriod: 'day'
      }
    });
  });

  it('accepts a partial update and leaves the other fields out', () => {
    const result = parseLimitsParams({ paused: true });
    expect(result).toEqual({ ok: true, value: { paused: true } });
  });

  it('accepts 0 as "no cap" for the numeric limits', () => {
    const result = parseLimitsParams({ maxMessageLength: 0, rateLimitCount: 0 });
    expect(result).toMatchObject({ ok: true, value: { maxMessageLength: 0, rateLimitCount: 0 } });
  });

  it('accepts every period in the enum', () => {
    for (const period of ['minute', 'hour', 'day']) {
      expect(parseLimitsParams({ rateLimitPeriod: period })).toMatchObject({
        ok: true,
        value: { rateLimitPeriod: period }
      });
    }
  });

  it('rejects an empty update outright', () => {
    expect(parseLimitsParams({})).toMatchObject({ ok: false, status: 400 });
  });

  it.each([
    ['a truthy string for paused', { paused: 'yes' }],
    ['a query object for paused', { paused: { $ne: false } }],
    ['a numeric imagesEnabled', { imagesEnabled: 1 }],
    ['a negative maxMessageLength', { maxMessageLength: -1 }],
    ['a fractional maxMessageLength', { maxMessageLength: 27.5 }],
    ['a maxMessageLength over the composer ceiling', { maxMessageLength: 1001 }],
    ['a stringy rateLimitCount', { rateLimitCount: '30' }],
    ['a query object for rateLimitCount', { rateLimitCount: { $gt: 0 } }],
    ['an absurd rateLimitCount', { rateLimitCount: 1e9 }],
    ['NaN for rateLimitCount', { rateLimitCount: NaN }],
    ['a made-up rateLimitPeriod', { rateLimitPeriod: 'fortnight' }],
    ['a numeric rateLimitPeriod', { rateLimitPeriod: 3600 }],
    ['a prototype-chain rateLimitPeriod', { rateLimitPeriod: 'toString' }]
  ])('rejects %s', (_label, params) => {
    const result = parseLimitsParams(params as Record<string, unknown>);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects the whole update if any one field is bad', () => {
    const result = parseLimitsParams({ paused: true, maxMessageLength: 'lots' });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});

describe('checkSendGate', () => {
  it('passes a plain text send with default settings', () => {
    expect(checkSendGate({}, TEXT_ONLY)).toEqual({ ok: true });
  });

  it('blocks everything when the room is paused', () => {
    expect(checkSendGate({ paused: true }, TEXT_ONLY)).toMatchObject({ ok: false, status: 403 });
  });

  it('does not treat a missing paused field as paused', () => {
    expect(checkSendGate({ paused: undefined }, TEXT_ONLY)).toEqual({ ok: true });
  });

  it('blocks an image send only when images are explicitly disabled', () => {
    const withImage = { ...TEXT_ONLY, hasImage: true };
    // Pre-existing docs have no imagesEnabled field; images predate the toggle
    // and must stay allowed for them.
    expect(checkSendGate({}, withImage)).toEqual({ ok: true });
    expect(checkSendGate({ imagesEnabled: true }, withImage)).toEqual({ ok: true });
    expect(checkSendGate({ imagesEnabled: false }, withImage)).toMatchObject({
      ok: false,
      status: 403
    });
  });

  it('keeps voice opt-in: anything short of an explicit true refuses audio', () => {
    const withAudio = { ...TEXT_ONLY, hasAudio: true };
    expect(checkSendGate({}, withAudio)).toMatchObject({ ok: false, status: 403 });
    expect(checkSendGate({ voiceEnabled: false }, withAudio)).toMatchObject({
      ok: false,
      status: 403
    });
    expect(checkSendGate({ voiceEnabled: true }, withAudio)).toEqual({ ok: true });
  });

  it('lets image-off rooms still take text', () => {
    expect(checkSendGate({ imagesEnabled: false }, TEXT_ONLY)).toEqual({ ok: true });
  });

  it('applies the ciphertext cap only when the room sets a length limit', () => {
    const huge = { ...TEXT_ONLY, ciphertextLength: 16_000 };
    expect(checkSendGate({}, huge)).toEqual({ ok: true });
    expect(checkSendGate({ maxMessageLength: 0 }, huge)).toEqual({ ok: true });
    expect(checkSendGate({ maxMessageLength: 280 }, huge)).toMatchObject({
      ok: false,
      status: 403
    });
    expect(
      checkSendGate({ maxMessageLength: 280 }, { ...TEXT_ONLY, ciphertextLength: 3000 })
    ).toEqual({ ok: true });
  });
});

describe('checkRoomRate', () => {
  it('returns null (no window consumed) when the room has no cap', () => {
    expect(checkRoomRate(`${RID}-uncapped`, 0, 'hour', 1000)).toBeNull();
    expect(checkRoomRate(`${RID}-uncapped`, undefined, 'hour', 1000)).toBeNull();
  });

  it('allows up to the cap within the window, then rejects with a retry hint', () => {
    const rid = `${RID}-capped`;
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) {
      expect(checkRoomRate(rid, 3, 'hour', t0 + i)?.allowed).toBe(true);
    }
    const rejected = checkRoomRate(rid, 3, 'hour', t0 + 10);
    expect(rejected?.allowed).toBe(false);
    expect(rejected?.retryAfterSec).toBeGreaterThan(0);
  });

  it('sizes the window by the chosen period', () => {
    const rid = `${RID}-minute`;
    const t0 = 5_000_000;
    expect(checkRoomRate(rid, 1, 'minute', t0)?.allowed).toBe(true);
    expect(checkRoomRate(rid, 1, 'minute', t0 + 1)?.allowed).toBe(false);
    // A minute window reopens after 60s; a day window would still be shut.
    expect(checkRoomRate(rid, 1, 'minute', t0 + 60_000)?.allowed).toBe(true);

    const dayRid = `${RID}-day`;
    expect(checkRoomRate(dayRid, 1, 'day', t0)?.allowed).toBe(true);
    expect(checkRoomRate(dayRid, 1, 'day', t0 + 60 * 60 * 1000)?.allowed).toBe(false);
    expect(checkRoomRate(dayRid, 1, 'day', t0 + 24 * 60 * 60 * 1000)?.allowed).toBe(true);
  });

  it('falls back to the hourly window for an unknown or missing period', () => {
    const rid = `${RID}-fallback`;
    const t0 = 7_000_000;
    expect(checkRoomRate(rid, 1, undefined, t0)?.allowed).toBe(true);
    // Same window: the undefined and garbage periods both resolve to 'hour'.
    expect(checkRoomRate(rid, 1, 'fortnight', t0 + 1)?.allowed).toBe(false);
    expect(checkRoomRate(rid, 1, undefined, t0 + 60 * 60 * 1000)?.allowed).toBe(true);
  });

  it('starts a fresh window when the owner switches periods', () => {
    const rid = `${RID}-switch`;
    const t0 = 9_500_000;
    expect(checkRoomRate(rid, 1, 'hour', t0)?.allowed).toBe(true);
    expect(checkRoomRate(rid, 1, 'hour', t0 + 1)?.allowed).toBe(false);
    expect(checkRoomRate(rid, 1, 'minute', t0 + 2)?.allowed).toBe(true);
  });

  it('tracks rooms independently', () => {
    const t0 = 9_000_000;
    expect(checkRoomRate(`${RID}-a`, 1, 'hour', t0)?.allowed).toBe(true);
    expect(checkRoomRate(`${RID}-b`, 1, 'hour', t0)?.allowed).toBe(true);
  });
});

// The server never sees plaintext, so the length limit is enforced as a cap on
// the armored ciphertext. These tests pin the two sides of that bargain
// against the real openpgp pipeline (encrypt to two keys + sign, exactly like
// /b/[room] does): a compliant worst-case message always fits under the cap,
// and a grossly oversized one always trips it.
describe('ciphertextCapFor vs real openpgp output', () => {
  const generatePair = () =>
    openpgp.generateKey({
      type: 'ecc',
      curve: 'curve25519',
      userIDs: [{ name: 'test' }],
      format: 'object'
    });

  const encryptLikeTheClient = async (text: string) => {
    const [a, b] = await Promise.all([generatePair(), generatePair()]);
    return (await openpgp.encrypt({
      message: await openpgp.createMessage({ text }),
      encryptionKeys: [a.publicKey, b.publicKey],
      signingKeys: a.privateKey
    })) as string;
  };

  it('a worst-case (all 4-byte emoji) message at the limit fits under the cap', async () => {
    const limit = 280;
    const armored = await encryptLikeTheClient('🚀'.repeat(limit / 2)); // 2 UTF-16 units each
    expect(armored.length).toBeLessThan(ciphertextCapFor(limit));
  });

  it('a message an order of magnitude over the limit trips the cap', async () => {
    const limit = 280;
    const armored = await encryptLikeTheClient('x'.repeat(limit * 10));
    expect(armored.length).toBeGreaterThan(ciphertextCapFor(limit));
  });

  it('the ceiling-sized message fits under its own cap', async () => {
    const armored = await encryptLikeTheClient('é'.repeat(MAX_MESSAGE_LENGTH_CEILING));
    expect(armored.length).toBeLessThan(ciphertextCapFor(MAX_MESSAGE_LENGTH_CEILING));
  });
});
