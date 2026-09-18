import { describe, it, expect } from 'vitest';
import { parseRidList, publicRoomSummary, MAX_RIDS } from './roomSummary';

describe('parseRidList', () => {
  it('reads a comma separated list', () => {
    const out = parseRidList('aaa,bbb,ccc');
    expect(out).toEqual({ ok: true, value: ['aaa', 'bbb', 'ccc'] });
  });

  it('trims and drops empty entries', () => {
    const out = parseRidList(' aaa , , bbb ,');
    expect(out).toEqual({ ok: true, value: ['aaa', 'bbb'] });
  });

  it('deduplicates rather than refusing the batch', () => {
    const out = parseRidList('aaa,aaa,bbb');
    expect(out).toEqual({ ok: true, value: ['aaa', 'bbb'] });
  });

  it('rejects an empty or missing parameter', () => {
    for (const input of [null, '', '   ', ',,,']) {
      expect(parseRidList(input as string | null).ok).toBe(false);
    }
  });

  it('rejects anything outside the rid character class', () => {
    // The point of the class: nothing shaped like a query operator, a regex,
    // or a path should ever reach the `$in`.
    for (const bad of ['a.b', '{"$ne":1}', 'aaa/bbb', 'aa bb', 'aaa$', 'a'.repeat(65)]) {
      const out = parseRidList(bad);
      expect(out.ok, bad).toBe(false);
      if (!out.ok) expect(out.status).toBe(400);
    }
  });

  it('caps the batch size', () => {
    const under = Array.from({ length: MAX_RIDS }, (_, i) => `rid${i}`).join(',');
    expect(parseRidList(under).ok).toBe(true);

    const over = Array.from({ length: MAX_RIDS + 1 }, (_, i) => `rid${i}`).join(',');
    const out = parseRidList(over);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.status).toBe(400);
  });

  it('counts the batch after deduplication, not before', () => {
    const repeated = Array.from({ length: MAX_RIDS + 20 }, () => 'same').join(',');
    expect(parseRidList(repeated)).toEqual({ ok: true, value: ['same'] });
  });
});

describe('publicRoomSummary', () => {
  it('returns the public values and nothing else', () => {
    const out = publicRoomSummary({
      rid: 'abc',
      title: 'Robi room',
      messages: 12
    });
    expect(out).toEqual({
      rid: 'abc',
      title: 'Robi room',
      messages: 12,
      theme: null
    });
  });

  it('never leaks another field, however the document grows', () => {
    const out = publicRoomSummary({
      rid: 'abc',
      title: 'x',
      messages: 1,
      // Every one of these is on the real Listener and must not come out.
      ...{
        webhookUrl: 'https://hook',
        pbKey: '-----BEGIN PGP PUBLIC KEY BLOCK-----'
      }
    });
    expect(Object.keys(out ?? {}).sort()).toEqual(['messages', 'rid', 'theme', 'title']);
  });

  it('reads the registration placeholder as no title at all', () => {
    // POST /api/pgp seeds `title: rid`, so a room that equals its own id has
    // never been named. Reporting it would make the row print the rid twice.
    expect(publicRoomSummary({ rid: 'abc', title: 'abc', messages: 0 })?.title).toBeNull();
    expect(publicRoomSummary({ rid: 'abc', title: ' abc ', messages: 0 })?.title).toBeNull();
    // A room genuinely named something else is untouched.
    expect(publicRoomSummary({ rid: 'abc', title: 'abcd', messages: 0 })?.title).toBe('abcd');
  });

  it('normalises a blank or missing title to null', () => {
    expect(publicRoomSummary({ rid: 'a', title: '   ', messages: 0 })?.title).toBeNull();
    expect(publicRoomSummary({ rid: 'a', messages: 0 })?.title).toBeNull();
  });

  it('trims a title', () => {
    expect(publicRoomSummary({ rid: 'a', title: '  hi  ', messages: 0 })?.title).toBe('hi');
  });

  it('falls back to zero for a missing or nonsense count', () => {
    expect(publicRoomSummary({ rid: 'a', messages: undefined })?.messages).toBe(0);
    expect(publicRoomSummary({ rid: 'a', messages: -3 })?.messages).toBe(0);
    expect(publicRoomSummary({ rid: 'a', messages: 'lots' })?.messages).toBe(0);
  });

  it('refuses a document with no rid', () => {
    expect(publicRoomSummary({ title: 'x', messages: 1 })).toBeNull();
    expect(publicRoomSummary({ rid: '', messages: 1 })).toBeNull();
  });
});
