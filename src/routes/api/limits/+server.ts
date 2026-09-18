import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import { verifySignedAction } from '$lib/server/signedAction';
import { parseLimitsParams, DEFAULT_RATE_PERIOD } from '$lib/server/roomLimits';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const publicShape = (room: any) => ({
  paused: room.paused === true,
  // Missing field (pre-toggle doc) means enabled — images predate this.
  imagesEnabled: room.imagesEnabled !== false,
  maxMessageLength: room.maxMessageLength ?? 0,
  rateLimitCount: room.rateLimitCount ?? 0,
  rateLimitPeriod: room.rateLimitPeriod ?? DEFAULT_RATE_PERIOD
});

// Public read — the send page needs all four values before the composer is
// worth rendering: paused decides whether to offer it at all, imagesEnabled
// whether to show the attach tile, maxMessageLength drives the counter.
// Like /api/voice this is only the UI half; PATCH /api/pgp enforces every
// one of these again server-side. Nothing here is secret: paused and the
// caps are all observable by just trying to send.
export async function GET({ url }) {
  const rid = url.searchParams.get('rid') ?? '';
  try {
    // A tombstone is not a room: filtered here so the endpoint's own 404
    // path runs, which every caller already handles.
    const room = await Listener.findOne(
      { rid, deletedAt: null },
      { paused: 1, imagesEnabled: 1, maxMessageLength: 1, rateLimitCount: 1, rateLimitPeriod: 1, _id: 0 }
    );

    if (room) {
      return json({ status: 200, body: publicShape(room) });
    }
    return json({ status: 404, body: 'Room not found' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching room limits' });
  }
}

// Owner-only write, authorized by a signature from the room's private key.
// Partial: each settings control sends just the field it owns.
export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'limits:set');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const parsed = parseLimitsParams(verdict.params);
  if (!parsed.ok) return json({ status: parsed.status, body: parsed.message });

  const { listener } = verdict;
  try {
    Object.assign(listener, parsed.value);
    await listener.save();
    return json({ status: 200, body: publicShape(listener) });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating room limits' });
  }
}
