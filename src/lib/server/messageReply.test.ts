import { describe, it, expect } from 'vitest';
import {
  parseReplyParams,
  checkReplyable,
  MAX_REPLY_CHARS,
  MAX_REPLIES_PER_MESSAGE
} from './messageReply';

const ID = 'a'.repeat(24);
const ROOM = 'room-rid-1234';
const SENDER = 'sender-rid-1234';

describe('parseReplyParams', () => {
  it('accepts a well-formed reply', () => {
    const result = parseReplyParams({ id: ID, room: ROOM, message: 'ciphertext' });
    expect(result).toEqual({ ok: true, value: { id: ID, room: ROOM, message: 'ciphertext' } });
  });

  it.each([
    ['a non-ObjectId id', { id: 'not-an-object-id', room: ROOM, message: 'x' }],
    ['a query object as id', { id: { $ne: null }, room: ROOM, message: 'x' }],
    ['a missing id', { room: ROOM, message: 'x' }],
    ['an id of the wrong length', { id: 'abc123', room: ROOM, message: 'x' }]
  ])('rejects %s', (_label, params) => {
    expect(parseReplyParams(params as Record<string, unknown>)).toMatchObject({
      ok: false,
      status: 400
    });
  });

  it('rejects a room rid with an illegal charset', () => {
    expect(parseReplyParams({ id: ID, room: 'has spaces!', message: 'x' })).toMatchObject({
      ok: false,
      status: 400
    });
  });

  it('rejects a query object as room', () => {
    expect(parseReplyParams({ id: ID, room: { $ne: null }, message: 'x' })).toMatchObject({
      ok: false,
      status: 400
    });
  });

  it('rejects empty text — unlike an edit, a reply has nothing else to carry', () => {
    expect(parseReplyParams({ id: ID, room: ROOM, message: '' })).toMatchObject({
      ok: false,
      status: 400
    });
  });

  it('rejects ciphertext over the size cap', () => {
    expect(
      parseReplyParams({ id: ID, room: ROOM, message: 'x'.repeat(MAX_REPLY_CHARS + 1) })
    ).toMatchObject({ ok: false, status: 400 });
  });

  it('accepts ciphertext exactly at the size cap', () => {
    expect(
      parseReplyParams({ id: ID, room: ROOM, message: 'x'.repeat(MAX_REPLY_CHARS) })
    ).toMatchObject({ ok: true });
  });

  it('rejects a non-string message', () => {
    expect(parseReplyParams({ id: ID, room: ROOM, message: { $gt: '' } })).toMatchObject({
      ok: false,
      status: 400
    });
  });
});

describe('checkReplyable', () => {
  it('lets the room owner reply to a message in their room', () => {
    expect(checkReplyable({ replies: [] }, ROOM, ROOM)).toEqual({ ok: true });
  });

  it('treats a message with no replies field as replyable', () => {
    expect(checkReplyable({}, ROOM, ROOM)).toEqual({ ok: true });
  });

  it('403s the sender trying to reply to their own message', () => {
    expect(checkReplyable({ replies: [] }, SENDER, ROOM)).toMatchObject({
      ok: false,
      status: 403
    });
  });

  it('403s any third party holding a valid signature for some other rid', () => {
    expect(checkReplyable({ replies: [] }, 'unrelated-rid-99', ROOM)).toMatchObject({
      ok: false,
      status: 403
    });
  });

  it('403s an empty signer rid rather than matching an empty room', () => {
    expect(checkReplyable({ replies: [] }, '', '')).toMatchObject({ ok: false, status: 403 });
  });

  it('403s a non-owner BEFORE revealing whether the message exists', () => {
    // Both calls must be indistinguishable, or the endpoint becomes an oracle
    // for "is this ObjectId a real message in your room".
    expect(checkReplyable(null, SENDER, ROOM)).toMatchObject({ ok: false, status: 403 });
    expect(checkReplyable({ replies: [] }, SENDER, ROOM)).toMatchObject({ ok: false, status: 403 });
  });

  it('404s a message that no longer exists, for the owner', () => {
    expect(checkReplyable(null, ROOM, ROOM)).toMatchObject({ ok: false, status: 404 });
  });

  it('409s once the thread hits the per-message cap', () => {
    const replies = new Array(MAX_REPLIES_PER_MESSAGE).fill({ message: 'x' });
    expect(checkReplyable({ replies }, ROOM, ROOM)).toMatchObject({ ok: false, status: 409 });
  });

  it('still allows the reply one below the cap', () => {
    const replies = new Array(MAX_REPLIES_PER_MESSAGE - 1).fill({ message: 'x' });
    expect(checkReplyable({ replies }, ROOM, ROOM)).toEqual({ ok: true });
  });
});
