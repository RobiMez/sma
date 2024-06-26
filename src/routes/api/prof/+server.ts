import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';

export async function PATCH({ request }) {
  const body = await request.json();
  const { rid, pbKey } = body;
  const profanityEnabledStatus = body.profanityEnabled;
  console.log('PATCH /api/prof/:pbKey called with body:', body);
  try {
    let room;

    if (profanityEnabledStatus === undefined) {
      // If profanityEnabled is not in the body, find the room and return its state
      room = await Listener.findOne({ rid: rid }, { profanityEnabled: 1, _id: 0 });
    } else {
      // If profanityEnabled is in the body, update the room with that state
      console.log('!!profanityEnabledStatus ', !!profanityEnabledStatus);

      room = await Listener.findOneAndUpdate(
        { rid: rid },
        { $set: { profanityEnabled: !!profanityEnabledStatus } },
        { new: true, fields: { profanityEnabled: 1, _id: 0 } }
      );

    }

    if (room) {
      return json({ status: 200, body: room });
    } else {
      return json({ status: 404, body: 'Room not found' });
    }
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating room' });
  }
}
