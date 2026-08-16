// Shape + authorization rules for editing an already-sent message. They live
// here rather than inline in /api/sent so they can be unit-tested without a
// database or a live request (same reason signedAction/webhookGuard do).
//
// Note what is NOT checked here, and can't be: whether the replacement
// ciphertext is really encrypted to both parties and signed by the author.
// The server only ever sees armor. The recipient's inbox is what enforces
// that — an edit that arrives unsigned or signed by the wrong key is refused
// there exactly like a spoofed send.

// Matches MAX_MESSAGE_CHARS in /api/pgp: an armored+signed 1000-char message
// is ~3KB, so 16KB leaves room for the second recipient packet and then some.
export const MAX_MESSAGE_CHARS = 16_384;

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const RID_PATTERN = /^[\w-]{8,64}$/;

export interface EditParams {
  id: string;
  room: string;
  message: string;
}

type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

/**
 * Validates the signed `params` of a `message:edit` request. Everything is
 * attacker-shaped until proven otherwise — `id` in particular goes straight
 * into a Mongoose query, so it has to be a literal ObjectId string and not,
 * say, `{ $ne: null }`.
 */
export function parseEditParams(params: Record<string, unknown>): Parsed<EditParams> {
  const { id, room, message } = params;

  if (typeof id !== 'string' || !OBJECT_ID_PATTERN.test(id)) {
    return { ok: false, status: 400, message: 'Invalid message id' };
  }
  if (typeof room !== 'string' || !RID_PATTERN.test(room)) {
    return { ok: false, status: 400, message: 'Invalid room' };
  }
  if (typeof message !== 'string' || message.length > MAX_MESSAGE_CHARS) {
    return { ok: false, status: 400, message: 'Invalid message' };
  }

  return { ok: true, value: { id, room, message } };
}

/** Same rid check the list endpoint does, on the room id it was handed. */
export function parseRoomParam(room: unknown): string | null {
  return typeof room === 'string' && RID_PATTERN.test(room) ? room : null;
}

interface EditableMessage {
  author?: string;
  image?: unknown;
  audio?: unknown;
}

/**
 * Decides whether `rid` — an rid whose ownership the signature check has
 * already proven — may replace this message's text with `newMessage`.
 *
 * `newMessage` is ciphertext, so "is it empty" is the only thing that can be
 * asked of it; that's enough to keep the send path's rule (a message must
 * carry text, an image, or a voice note) true after an edit too.
 */
export function checkEditable(
  message: EditableMessage | null | undefined,
  rid: string,
  newMessage: string
): { ok: true } | { ok: false; status: number; message: string } {
  if (!message) return { ok: false, status: 404, message: 'Message not found' };

  // The `author` field is set by whoever sent the message, so it can't prove
  // authorship on its own — but combined with the verified signature on this
  // request it does: an attacker can claim someone else's rid as author, and
  // in doing so locks themselves out of editing it.
  if (message.author !== rid) {
    return { ok: false, status: 403, message: 'You can only edit messages you sent' };
  }

  if (!newMessage && !message.image && !message.audio) {
    return {
      ok: false,
      status: 400,
      message: 'Message must include text, an image, or a voice note'
    };
  }

  return { ok: true };
}
