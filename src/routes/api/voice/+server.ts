import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import { verifySignedAction } from '$lib/server/signedAction';

// Public read — senders need to know whether this room takes voice notes at
// all before the recorder is worth showing (mirrors /api/profanity's GET).
// Unlike the profanity flag this is only the UI half: the send path enforces
// it again server-side, so hiding the recorder is a courtesy, not the gate.
export async function GET({ url }) {
  const rid = url.searchParams.get('rid') ?? '';
  try {
    const room = await Listener.findOne({ rid }, { voiceEnabled: 1, _id: 0 });

    if (room) {
      return json({ status: 200, body: room });
    }
    return json({ status: 404, body: 'Room not found' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching voice state' });
  }
}

// Owner-only write, authorized by a signature from the room's private key.
export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'voice:set');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const { listener, params } = verdict;
  try {
    listener.voiceEnabled = !!params.voiceEnabled;
    await listener.save();
    return json({ status: 200, body: { voiceEnabled: listener.voiceEnabled } });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating room' });
  }
}
