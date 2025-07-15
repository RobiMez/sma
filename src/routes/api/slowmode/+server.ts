import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';

export async function GET({ url }) {
  const rid = url.searchParams.get('rid') ?? '';

  try {
    const listener = await Listener.findOne({ rid });
    if (!listener) {
      return json({ status: 404, error: true, message: 'Listener not found' });
    }

    return json({
      status: 200,
      body: {
        slowModeEnabled: listener.slowModeEnabled,
        slowModeDelay: listener.slowModeDelay
      }
    });
  } catch (error) {
    console.error(error);
    return json({ status: 500, error: true, message: 'Error fetching slow mode settings' });
  }
}

export async function PATCH({ request }) {
  const { rid, slowModeEnabled, slowModeDelay } = await request.json();

  if (!rid) {
    return json({ status: 400, error: true, message: 'Room ID is required' });
  }

  try {
    const listener = await Listener.findOneAndUpdate(
      { rid },
      {
        slowModeEnabled: slowModeEnabled ?? false,
        slowModeDelay: slowModeDelay ?? 0
      },
      { new: true }
    );

    if (!listener) {
      return json({ status: 404, error: true, message: 'Listener not found' });
    }

    return json({
      status: 200,
      body: {
        slowModeEnabled: listener.slowModeEnabled,
        slowModeDelay: listener.slowModeDelay
      }
    });
  } catch (error) {
    console.error(error);
    return json({ status: 500, error: true, message: 'Error updating slow mode settings' });
  }
}
