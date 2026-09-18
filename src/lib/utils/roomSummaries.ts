import { apiUrl } from '$lib/api';
import { MAX_RIDS, type RoomSummary } from '$lib/config/rooms';

export type { RoomSummary };

/**
 * Reads title, worn theme and message count for a set of rooms, keyed by rid.
 *
 * Batched deliberately: `/i` can list a dozen identities, and asking the three
 * single-room endpoints for each would be three dozen requests to draw one
 * screen.
 *
 * Fails open to an empty map. These values tell
 * somebody which identities are worth keeping; they are not what makes the
 * page work, and a failed read must leave a usable list of rooms rather than
 * an error page.
 */
export async function loadRoomSummaries(rids: string[]): Promise<Record<string, RoomSummary>> {
  const wanted = [...new Set(rids.filter(Boolean))];
  if (!wanted.length) return {};

  const out: Record<string, RoomSummary> = {};
  // Chunked to the server's own cap, so a browser holding more identities than
  // one request allows still gets all of them rather than a 400.
  const chunks: string[][] = [];
  for (let i = 0; i < wanted.length; i += MAX_RIDS) chunks.push(wanted.slice(i, i + MAX_RIDS));

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const resp = await fetch(
          apiUrl(`/api/rooms?rids=${encodeURIComponent(chunk.join(','))}`)
        ).then((r) => r.json());
        // `{ status, body }` envelope, never `{ error }`.
        if (resp?.status !== 200 || !Array.isArray(resp.body?.rooms)) return;
        for (const room of resp.body.rooms as RoomSummary[]) out[room.rid] = room;
      } catch (e) {
        console.error('Failed to read room summaries', e);
      }
    })
  );

  return out;
}
