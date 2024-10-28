import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import Image from '../../../models/file.schema';

interface Listener {
  pbKey: string;
  rid: string;
}

async function sendWebhookNotification(webhookUrl: string, message: any) {
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: message.message,
        timestamp: message.createdAt,
        author: message.author
      })
    });
  } catch (error) {
    console.error('Webhook notification failed:', error);
  }
}

async function saveImage(imageData: { dataURI: string; blurhash: string; nsfw: boolean }) {
  if (!imageData.dataURI.length) return null;

  const image = new Image({
    dataURI: imageData.dataURI,
    blurhash: imageData.blurhash,
    nsfw: imageData.nsfw
  });
  await image.save();
  return image;
}

async function createMessage(messageText: string, imageId: string | null, author: string) {
  const message = new Message({
    message: messageText,
    image: imageId,
    author
  });
  await message.save();
  return message;
}

async function updateListenerWithMessage(recipientId: string, messageId: string) {
  return await Listener.findOneAndUpdate(
    { rid: recipientId },
    {
      $push: {
        messages: {
          $each: [messageId],
          $position: 0
        }
      }
    },
    { new: true }
  );
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
  const { message, imageData, r: author, p: recipientId } = await request.json();

  try {
    const image = await saveImage(imageData);
    const newMessage = await createMessage(message, image?._id ?? null, author);
    const listener = await updateListenerWithMessage(recipientId, newMessage._id);

    if (listener?.webhookUrl) {
      await sendWebhookNotification(listener.webhookUrl, newMessage);
    }

    return listener
      ? json({ status: 200, body: listener })
      : json({ status: 404, body: 'Listener not found' });
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
