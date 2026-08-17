import { describe, it, expect, beforeAll } from 'vitest';
import { webcrypto } from 'node:crypto';
import { createShortHash } from './hashing';

// hashing.ts reaches for `window.crypto.subtle` because it only ever runs in
// the browser; give it one.
beforeAll(() => {
  if (typeof globalThis.window === 'undefined') {
    (globalThis as unknown as { window: unknown }).window = { crypto: webcrypto };
  }
});

// An rid is the identity's name: it is minted once by this function (utils/pgp.ts)
// and re-derived later to unlock the inbox (/li/[room]). Both sides must agree
// bit-for-bit forever, so these fixtures are pinned rather than round-tripped —
// a round-trip test passes happily while both sides are wrong together.
//
// The fixtures deliberately cover base64 padding chars, because that is where a
// duplicate copy of this function inside /li/[room]/+page.svelte had drifted: it
// called `.replace('+', '-')` with a *string* pattern, which substitutes only the
// first occurrence, so any hash carrying two or more `+`/`/` was re-derived
// wrongly and its owner could never open their own inbox.
describe('createShortHash', () => {
  it('is 12 chars of base64url for a plain hash', async () => {
    expect(await createShortHash('sma-fixture-0', 12)).toMatch(/^[A-Za-z0-9_-]{12}$/);
  });

  it('translates every "/" in the hash, not just the first', async () => {
    // raw base64 head is "/dfwNpd/OFGT" — two slashes
    expect(await createShortHash('sma-fixture-105', 12)).toBe('_dfwNpd_OFGT');
  });

  it('translates every "+" in the hash, not just the first', async () => {
    // raw base64 head is "j2ug14++o2eR" — two pluses
    expect(await createShortHash('sma-fixture-12', 12)).toBe('j2ug14--o2eR');
  });

  it('translates "+" and "/" appearing together', async () => {
    // raw base64 head is "r6htWds/n+pg"
    expect(await createShortHash('sma-fixture-14', 12)).toBe('r6htWds_n-pg');
  });

  it('never leaks a raw base64 char into an rid', async () => {
    for (let i = 0; i < 400; i++) {
      expect(await createShortHash(`sma-fixture-${i}`, 12)).toMatch(/^[A-Za-z0-9_-]{12}$/);
    }
  });

  it('is stable across calls', async () => {
    const a = await createShortHash('sma-fixture-105', 12);
    const b = await createShortHash('sma-fixture-105', 12);
    expect(a).toBe(b);
  });
});
