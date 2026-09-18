import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import { parseRidList, publicRoomSummary } from '$lib/server/roomSummary';

/**
 * Public batch read: title and message count for a list of rids.
 *
 * It exists because `/i` lists every identity this browser holds, and doing it
 * with the existing single-room endpoints would be several requests per
 * identity. A browser with a dozen rooms would open dozens of connections to
 * draw one screen.
 *
 * Unsigned, like the reads it batches. Each value is already public on its
 * own for anyone holding a room's share link: the title via /api/title, and
 * the message count via GET /api/pgp, which hands over the room's entire
 * ciphertext. Nothing here is newly exposed. That argument is what any future
 * addition to the projection has to make as well, and `publicRoomSummary` is
 * where it gets enforced, so a later `Listener` field cannot arrive in this
 * response by simply existing.
 *
 * Enumeration is not a concern the other way round: an rid is a 12-char
 * base64url hash of a keypair, so the only way to ask about a room is to have
 * been given its link already.
 */
export async function GET({ url }) {
  const parsed = parseRidList(url.searchParams.get('rids'));
  if (!parsed.ok) return json({ status: parsed.status, body: parsed.message });

  try {
    // Aggregation rather than find(), for `$size`: `Listener.messages` holds
    // one ObjectId per message, so a plain projection would ship the entire
    // array of a busy room across the wire just to count it.
    const docs = await Listener.aggregate([
      // Deleted rooms are absent rather than reported, which is the same
      // thing this endpoint already does with an rid it has never seen. A
      // browser still holding a deleted identity (restored from a backup,
      // say) draws it as a plain row instead of claiming it is still there.
      { $match: { rid: { $in: parsed.value }, deletedAt: null } },
      {
        $project: {
          _id: 0,
          rid: 1,
          title: 1,
          messages: { $size: { $ifNull: ['$messages', []] } }
        }
      }
    ]);

    // Unknown rids are simply absent from the result. A browser can hold an
    // identity whose Listener never registered (see ResetPgpIdentity), and
    // that is a row to draw plainly, not an error for the whole batch.
    const rooms = docs.map(publicRoomSummary).filter(Boolean);
    return json({ status: 200, body: { rooms } });
  } catch (error) {
    console.error('GET /api/rooms error:', error);
    return json({ status: 500, body: 'Error fetching rooms' });
  }
}
