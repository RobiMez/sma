import { json } from "@sveltejs/kit";
import Listener from "../../../models/listener.schema";

interface Listener {
  pbKey: string;
  rid: string;
}

export async function GET({ url }) {

  const rid = url.searchParams.get('r') ?? '';
  const lim = parseInt(url.searchParams.get('lim') ?? '100');

  const user = await Listener.findOne({ rid }, { messages: { $slice: -lim } });

  if (user) {
    return json({ status: 200, body: user });
  }

  return json({ status: 404, body: 'Public key not found' });

}

export async function PATCH({ request }) {
  const body = await request.json();
  const { message, r, p, timestamp } = body;

  try {

    const user = await Listener.findOneAndUpdate(
      { rid: p },
      { $push: { messages: { message, r, timestamp } } },
      { new: true }
    );

    if (user) {
      return json({ status: 200, body: user });
    } else {
      return json({ status: 404, body: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating user' });
  }
}

export async function POST({ request }) {
  const body = await request.json();
  const { pbKey, rid } = body as unknown as Listener;
  const newListener = new Listener({
    pbKey,
    rid,
    title: rid,
    messages: []
  });

  try {
    await newListener.save();
    return json({ status: 200, body: 'Listener saved successfully' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error saving listener' });
  }
}
