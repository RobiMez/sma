import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import { verifySignedAction } from '$lib/server/signedAction';

// Public read — senders need to know whether to run the profanity check
// before encrypting their message.
export async function GET({ url }) {
  const rid = url.searchParams.get('rid') ?? '';
  try {
    const room = await Listener.findOne({ rid }, { profanityEnabled: 1, _id: 0 });

    if (room) {
      return json({ status: 200, body: room });
    }
    return json({ status: 404, body: 'Room not found' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching profanity state' });
  }
}

// Owner-only write, authorized by a signature from the room's private key.
export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'profanity:set');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const { listener, params } = verdict;
  try {
    listener.profanityEnabled = !!params.profanityEnabled;
    await listener.save();
    return json({ status: 200, body: { profanityEnabled: listener.profanityEnabled } });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating room' });
  }
}
