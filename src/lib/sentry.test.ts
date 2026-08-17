import { describe, it, expect } from 'vitest';
import { scrubString, scrubEvent, PGP_PLACEHOLDER, RID_PLACEHOLDER } from './sentry';

const ARMORED = `-----BEGIN PGP MESSAGE-----

wV4DhP+cQz0eXYASAQdA5b9M0k7hR8kJ0hZ0Z0lm
=abcd
-----END PGP MESSAGE-----`;

describe('scrubString', () => {
  it('removes an armored PGP block', () => {
    const out = scrubString(`readMessage failed on: ${ARMORED}`);
    expect(out).not.toContain('BEGIN PGP');
    expect(out).not.toContain('wV4DhP');
    expect(out).toContain(PGP_PLACEHOLDER);
  });

  it('removes an armored private key block', () => {
    const key =
      '-----BEGIN PGP PRIVATE KEY BLOCK-----\n\nxYYEaoIT\n-----END PGP PRIVATE KEY BLOCK-----';
    expect(scrubString(key)).toBe(PGP_PLACEHOLDER);
  });

  it('removes every block when several appear', () => {
    const out = scrubString(`${ARMORED} and then ${ARMORED}`);
    expect(out).not.toContain('BEGIN PGP');
    expect(out.match(/\[pgp-block-redacted\]/g)).toHaveLength(2);
  });

  it('redacts the room id in an inbox url but keeps the route', () => {
    expect(scrubString('https://sma.et/li/9WKgh__MaN6t')).toBe(
      `https://sma.et/li/${RID_PLACEHOLDER}`
    );
  });

  it('redacts the room id in a send url', () => {
    expect(scrubString('https://sma.et/b/oDavRBo-wMOt?x=1')).toBe(
      `https://sma.et/b/${RID_PLACEHOLDER}?x=1`
    );
  });

  it('redacts rids passed as query params', () => {
    expect(scrubString('/api/pgp?r=9WKgh__MaN6t&since=2026-08-17')).toBe(
      `/api/pgp?r=${RID_PLACEHOLDER}&since=2026-08-17`
    );
  });

  it('leaves the SvelteKit route pattern alone', () => {
    // This is the transaction name; it identifies nobody and is what makes
    // Sentry's grouping usable.
    expect(scrubString('/li/[room]')).toBe('/li/[room]');
  });

  it('does not eat hashed asset filenames that merely sit under /b/', () => {
    const asset = '/b/abcdefghijkl.js';
    expect(scrubString(asset)).toBe(asset);
  });

  it('leaves ordinary error text untouched', () => {
    const msg = 'TypeError: Cannot read properties of undefined (reading "length")';
    expect(scrubString(msg)).toBe(msg);
  });
});

describe('scrubEvent', () => {
  it('scrubs strings nested anywhere in the event', () => {
    const event = {
      message: `boom ${ARMORED}`,
      request: { url: 'https://sma.et/li/9WKgh__MaN6t' },
      exception: {
        values: [{ type: 'Error', value: `decrypt failed: ${ARMORED}` }]
      },
      breadcrumbs: [
        { message: 'navigated', data: { to: 'https://sma.et/b/oDavRBo-wMOt' } },
        { message: 'fetch', data: { url: '/api/pgp?r=9WKgh__MaN6t' } }
      ],
      extra: { deep: { deeper: { url: 'https://sma.et/li/9WKgh__MaN6t' } } }
    };

    const out = scrubEvent(event);
    const asText = JSON.stringify(out);

    expect(asText).not.toContain('BEGIN PGP');
    expect(asText).not.toContain('9WKgh__MaN6t');
    expect(asText).not.toContain('oDavRBo-wMOt');
    // ...while the structure and the useful parts survive.
    expect(out.exception.values[0].type).toBe('Error');
    expect(out.request.url).toBe(`https://sma.et/li/${RID_PLACEHOLDER}`);
    expect(out.breadcrumbs).toHaveLength(2);
  });

  it('survives null, numbers and undefined without throwing', () => {
    expect(scrubEvent({ a: null, b: 1, c: undefined, d: true })).toEqual({
      a: null,
      b: 1,
      c: undefined,
      d: true
    });
  });

  it('terminates on a deeply nested object', () => {
    let node: Record<string, unknown> = { url: '/li/9WKgh__MaN6t' };
    for (let i = 0; i < 40; i++) node = { child: node };
    expect(() => scrubEvent(node)).not.toThrow();
  });
});
