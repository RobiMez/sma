import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import { verifySignedAction } from '$lib/server/signedAction';

// Public read — the sender page shows the room title to anyone with the link.
export async function GET(request) {
  const rid = request.url.searchParams.get('rid');
  try {
    const room = await Listener.findOne({ rid: rid }, { title: 1, rid: 1 });

    if (room) {
      return json({ status: 200, body: room });
    } else {
      return json({ status: 404, body: 'Room not found' });
    }
  } catch (error) {
    console.error('GET error:', error);
    return json({ status: 500, body: 'Error fetching room title' });
  }
}

// Owner-only write, authorized by a signature from the room's private key.
export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'title:set');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const { listener, params } = verdict;
  const title = typeof params.title === 'string' ? params.title.trim() : '';
  if (!title || title.length > 64) {
    return json({ status: 400, body: 'title must be a non-empty string of at most 64 chars' });
  }

  try {
    listener.title = title;
    await listener.save();
    return json({ status: 200, body: { title: listener.title, rid: listener.rid } });
  } catch (error) {
    console.error('PATCH error:', error);
    return json({ status: 500, body: 'Error updating room' });
  }
}
