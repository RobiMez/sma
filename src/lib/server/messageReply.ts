// Shape + authorization rules for replying to a message. Split out of
// /api/reply for the same reason messageEdit.ts is: it's the part worth
// unit-testing, and it tests without a database or a live request.
//
// Editing and replying are mirror images. An edit is authorized by the
// *sender's* signature and rewrites the message; a reply is authorized by the
// *room owner's* signature and appends to it. Both ride the same
// verifySignedAction machinery, which only ever proves "the caller controls
// this rid" — deciding which rid that has to be is each endpoint's job, and
// for replies it's the room itself.

// Same cap as an edit, and for the same reason: an armored, signed, two-
// recipient 1000-char message lands around 3KB.
export const MAX_REPLY_CHARS = 16_384;

// Replies are owner-only, so this isn't an abuse limit — it's a bound on how
// fat a single message doc can get, since every inbox poll and every
// /api/sent listing carries the whole thread inline.
export const MAX_REPLIES_PER_MESSAGE = 50;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const RID_PATTERN = /^[\w-]{8,64}$/;

export interface ReplyParams {
  id: string;
  room: string;
  message: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

/**
 * Validates the signed `params` of a `message:reply` request. As with edits,
 * `id` reaches a Mongoose query, so it has to be a literal ObjectId string
 * rather than something query-shaped like `{ $ne: null }`.
 *
 * Unlike an edit, empty text is rejected outright: an edit may legitimately
 * blank the text of a message an image or voice note still carries, but a
 * reply with no content is nothing at all.
 */
export function parseReplyParams(params: Record<string, unknown>): Parsed<ReplyParams> {
  const { id, room, message } = params;

  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) {
    return { ok: false, status: 400, message: 'Invalid message id' };
  }
  if (typeof room !== 'string' || !RID_PATTERN.test(room)) {
    return { ok: false, status: 400, message: 'Invalid room' };
  }
  if (typeof message !== 'string' || !message || message.length > MAX_REPLY_CHARS) {
    return { ok: false, status: 400, message: 'Invalid reply' };
  }

  return { ok: true, value: { id, room, message } };
}

interface ReplyableMessage {
  replies?: unknown[];
}

/**
 * Decides whether `signerRid` — an rid the signature check has already proven
 * the caller controls — may append a reply to this message.
 *
 * The ownership test comes first, before the message is even looked at, so
 * that a caller who isn't the room owner gets the same 403 whether or not the
 * id they guessed exists. Answering 404-then-403 would turn this endpoint into
 * an oracle for "is this ObjectId a real message in your room".
 */
export function checkReplyable(
  message: ReplyableMessage | null | undefined,
  signerRid: string,
  room: string
): { ok: true } | { ok: false; status: number; message: string } {
  // Replies flow one way: room owner -> sender. A sender holding a valid
  // signature for their *own* rid still can't reply to their own message,
  // which is what keeps this from becoming a general comment thread.
  if (!signerRid || signerRid !== room) {
    return { ok: false, status: 403, message: 'Only the room owner can reply' };
  }

  if (!message) return { ok: false, status: 404, message: 'Message not found' };

  const replyCount = Array.isArray(message.replies) ? message.replies.length : 0;
  if (replyCount >= MAX_REPLIES_PER_MESSAGE) {
    return {
      ok: false,
      status: 409,
      message: `This message already has ${MAX_REPLIES_PER_MESSAGE} replies`
    };
  }

  return { ok: true };
}
