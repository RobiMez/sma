import { MAX_RIDS, type RoomSummary } from '$lib/config/rooms';

export { MAX_RIDS, type RoomSummary };

// Shape and validation for the batch room read behind GET /api/rooms. Pure, so
// it can be tested without a database.

// An rid is a 12-char base64url hash today, but older ones exist and the
// length is not something this endpoint should be asserting. The character
// class is the part that matters: it keeps anything shaped like an operator
// out of the query.
const RID = /^[A-Za-z0-9_-]{1,64}$/;

type Parsed<T> = { ok: true; value: T } | { ok: false; status: number; message: string };

/**
 * Reads the comma-separated `rids` query parameter.
 *
 * Deduplicates rather than rejecting repeats: the caller is a browser listing
 * whatever is in its own localStorage, and a duplicate there is its problem to
 * have, not a reason to refuse the whole batch.
 */
export function parseRidList(raw: string | null): Parsed<string[]> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return { ok: false, status: 400, message: 'rids is required' };
  }

  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const rid = part.trim();
    if (!rid) continue;
    if (!RID.test(rid)) return { ok: false, status: 400, message: 'invalid rid' };
    seen.add(rid);
    if (seen.size > MAX_RIDS) {
      return { ok: false, status: 400, message: `at most ${MAX_RIDS} rids per request` };
    }
  }

  if (!seen.size) return { ok: false, status: 400, message: 'rids is required' };
  return { ok: true, value: [...seen] };
}

/**
 * What the batch read returns for one room.
 *
 * Deliberately narrow. Every field on `Listener` lands in a response by
 * default unless something stops it, which is the mistake this whole file
 * exists to avoid repeating: the values here are each already public on
 * their own (title via /api/title, and the message count via GET /api/pgp,
 * which hands the room's whole ciphertext to anyone holding the share link).
 * Nothing else from the document is included, and nothing else should be
 * added without the same argument. `theme` stays in the response shape for
 * client compatibility and is always null here.
 */
export function publicRoomSummary(doc: {
  rid?: unknown;
  title?: unknown;
  messages?: unknown;
}): RoomSummary | null {
  if (typeof doc?.rid !== 'string' || !doc.rid) return null;

  // A room registers with `title: rid` (see POST /api/pgp), so a title equal
  // to the rid means nobody ever named it. Reporting it as a title would make
  // every untitled room render its own id twice.
  const title = typeof doc.title === 'string' ? doc.title.trim() : '';

  return {
    rid: doc.rid,
    title: title && title !== doc.rid ? title : null,
    messages: typeof doc.messages === 'number' && doc.messages >= 0 ? doc.messages : 0,
    theme: null
  };
}
