import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import Image from '../../../models/file.schema';
import Room from '../../../models/room.schema';

interface Listener {
  pbKey: string;
  rid: string;
}

export async function GET({ url }) {
  const rid = url.searchParams.get('r') ?? '';
  const lim = parseInt(url.searchParams.get('lim') ?? '100');

  const user = await Listener.findOne({ rid }, { messages: { $slice: -lim } }).populate({
    path: 'messages',
    populate: {
      path: 'image',
      model: 'Image',
      select: '-dataURI'
    }
  });
  if (user) {
    return json({ status: 200, body: user });
  }

  return json({ status: 404, body: 'Public key not found' });
}

export async function PATCH({ request }) {
  const body = await request.json();
  const { message, imageData, r, p } = body;

  console.log('Calling with body: 🌏🌏', body);

  try {
    // Check if the room has slow mode enabled
    const room = await Room.findOne({ rid: p });
    if (room && room.slowMode > 0) {
      const lastMessage = await Message.findOne({ author: r }).sort({ timestamp: -1 });
      if (lastMessage) {
        const now = new Date();
        const diff = (now.getTime() - new Date(lastMessage.timestamp).getTime()) / 1000;
        if (diff < room.slowMode) {
          return json({ status: 429, body: 'Slow mode is enabled. Please wait before sending another message.' });
        }
      }
    }

    // Check if the image data exists
    let image;
    console.log('⌛⌛', imageData.dataURI);
    if (imageData.dataURI.length) {
      // Create a new image document
      image = new Image({
        dataURI: imageData.dataURI,
        blurhash: imageData.blurhash,
        nsfw: imageData.nsfw
      });
      // Save the image document to get its _id
      await image.save();
    }

    // Create a new message record and save it
    const new_message = new Message({
      message,
      image: image ? image._id : null,
      author: r
    });
    await new_message.save();

    // Update the Listener document with the new message and image data
    const listener = await Listener.findOneAndUpdate(
      { rid: p },
      {
        $push: {
          messages: {
            $each: [new_message._id],
            $position: 0
          }
        }
      },
      { new: true }
    );

    console.log('After update ⌛⌛', listener);

    if (listener) {
      return json({ status: 200, body: listener });
    } else {
      return json({ status: 404, body: 'Listener not found' });
    }
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating listener' });
  }
}

export async function POST({ request }) {
  const body = await request.json();
  const { pbKey, rid } = body as unknown as Listener;

  if (!pbKey || !rid)
    return json({ status: 500, body: 'Error saving listener : supply pbkey & rid' });

  const newListener = new Listener({
    pbKey,
    rid,
    title: rid,
    profanityEnabled: true,
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
