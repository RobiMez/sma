import { describe, it, expect } from 'vitest';
import { parseEditParams, parseRoomParam, checkEditable, MAX_MESSAGE_CHARS } from './messageEdit';

const ID = 'a'.repeat(24);
const RID = 'test-rid-1234';

describe('parseEditParams', () => {
  it('accepts a well-formed edit', () => {
    const result = parseEditParams({ id: ID, room: RID, message: 'ciphertext' });
    expect(result).toEqual({ ok: true, value: { id: ID, room: RID, message: 'ciphertext' } });
  });

  it('accepts empty text (the message may be carried by an attachment)', () => {
    const result = parseEditParams({ id: ID, room: RID, message: '' });
    expect(result.ok).toBe(true);
  });

  it.each([
    ['a non-ObjectId id', { id: 'not-an-object-id', room: RID, message: 'x' }],
    ['a query object as id', { id: { $ne: null }, room: RID, message: 'x' }],
    ['a missing id', { room: RID, message: 'x' }],
    ['an id of the wrong length', { id: 'abc123', room: RID, message: 'x' }]
  ])('rejects %s', (_label, params) => {
    const result = parseEditParams(params as Record<string, unknown>);
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a room rid with an illegal charset', () => {
    const result = parseEditParams({ id: ID, room: 'has spaces!', message: 'x' });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects ciphertext over the size cap', () => {
    const result = parseEditParams({
      id: ID,
      room: RID,
      message: 'x'.repeat(MAX_MESSAGE_CHARS + 1)
    });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects a non-string message', () => {
    const result = parseEditParams({ id: ID, room: RID, message: { $gt: '' } });
    expect(result).toMatchObject({ ok: false, status: 400 });
  });
});

describe('parseRoomParam', () => {
  it('returns a valid rid', () => {
    expect(parseRoomParam(RID)).toBe(RID);
  });

  it.each([[undefined], [42], [{ $ne: null }], ['short'], ['bad/rid']])('rejects %s', (value) => {
    expect(parseRoomParam(value)).toBeNull();
  });
});

describe('checkEditable', () => {
  it('lets the author replace their own text', () => {
    expect(checkEditable({ author: RID }, RID, 'new ciphertext')).toEqual({ ok: true });
  });

  it('404s a message that no longer exists', () => {
    expect(checkEditable(null, RID, 'x')).toMatchObject({ ok: false, status: 404 });
  });

  it("403s an edit of somebody else's message", () => {
    expect(checkEditable({ author: 'someone-else' }, RID, 'x')).toMatchObject({
      ok: false,
      status: 403
    });
  });

  it('403s a message with no author at all', () => {
    expect(checkEditable({}, RID, 'x')).toMatchObject({ ok: false, status: 403 });
  });

  it('refuses to empty out a text-only message', () => {
    expect(checkEditable({ author: RID }, RID, '')).toMatchObject({ ok: false, status: 400 });
  });

  it('allows empty text when an image or voice note carries the message', () => {
    expect(checkEditable({ author: RID, image: 'img-id' }, RID, '')).toEqual({ ok: true });
    expect(checkEditable({ author: RID, audio: 'audio-id' }, RID, '')).toEqual({ ok: true });
  });
});
