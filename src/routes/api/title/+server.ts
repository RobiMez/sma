import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';

interface Listener {
  pbKey: string;
  rid: string;
  title: string;
}

export async function GET(request) {
  const rid = request.url.searchParams.get('rid');
  console.log('GET /api/title/:rid called with rid:', rid, typeof rid);
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

export async function PATCH({ request }) {
  const body = await request.json();
  const { pbKey, title } = body as Listener;
  try {

    const room = await Listener.findOneAndUpdate(
      { pbKey: pbKey },
      { $set: { title: title } },
      { new: true }
    );
    if (room) {
      return json({ status: 200, body: room });
    } else {
      return json({ status: 404, body: 'Room not found' });
    }
  } catch (error) {
    console.error('PATCH error:', error);
    return json({ status: 500, body: 'Error updating room' });
  }
}
