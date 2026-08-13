import { json } from '@sveltejs/kit';
import * as openpgp from 'openpgp';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import Image from '../../../models/file.schema';
import Audio from '../../../models/audio.schema';
import { isSafeWebhookUrl } from '$lib/server/webhookGuard';
import { notifyRoom } from '$lib/server/wsRegistry.js';

interface Listener {
  pbKey: string;
  rid: string;
}

// rids are 12-char base64url hashes; be lenient on length, strict on charset.
const RID_PATTERN = /^[\w-]{8,64}$/;
// Armored+signed ciphertext of a 1000-char message is ~3KB; 16KB is generous.
const MAX_MESSAGE_CHARS = 16_384;
// Client caps image files at 1.5MB; base64 + chunking overhead lands under this.
const MAX_IMAGE_CHARS = 3_000_000;
// Client caps recordings at 30s; the "deep" preset slows playback (and so
// stretches duration) to ~38s of 16kHz mono WAV (~1.2MB) before PGP armor
// (~1.7M chars armored). This leaves headroom over that worst case.
const MAX_AUDIO_CHARS = 2_500_000;
const MAX_AUDIO_DURATION_SEC = 120;
const MAX_PBKEY_CHARS = 16_384;

async function sendWebhookNotification(webhookUrl: string, message: any) {
  // Re-check at send time — the DB may hold URLs saved before validation
  // existed. redirect: 'error' stops redirect-based SSRF hops.
  if (!isSafeWebhookUrl(webhookUrl)) {
    console.error(`Skipping webhook: unsafe URL ${webhookUrl}`);
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        content: message.message,
        timestamp: message.timestamp,
        author: message.author
      })
    });
    if (!res.ok) {
      console.error(
        `Webhook notification failed: ${res.status} ${res.statusText} from ${webhookUrl}`
      );
    }
  } catch (error) {
    console.error('Webhook notification failed:', error);
  }
}

async function saveImage(imageData: { dataURI: string[]; blurhash: string; nsfw: boolean }) {
  if (!imageData.dataURI.length) return null;

  const image = new Image({
    dataURI: imageData.dataURI,
    blurhash: imageData.blurhash,
    nsfw: imageData.nsfw
  });
  await image.save();
  return image;
}

async function saveAudio(audioData: { dataURI: string[]; duration: number }) {
  if (!audioData.dataURI.length) return null;

  const audio = new Audio({
    dataURI: audioData.dataURI,
    duration: audioData.duration
  });
  await audio.save();
  return audio;
}

async function createMessage(
  messageText: string,
  imageId: string | null,
  audioId: string | null,
  author: string
) {
  const message = new Message({
    message: messageText,
    image: imageId,
    audio: audioId,
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
  const parsedLim = parseInt(url.searchParams.get('lim') ?? '100');
  const lim = Number.isFinite(parsedLim) ? parsedLim : 100;
  const since = url.searchParams.get('since');
  const sinceDate = since && !isNaN(Date.parse(since)) ? new Date(since) : null;

  // Messages are $pushed at $position 0, so the newest ones sit at the FRONT
  // of the array — a positive $slice takes those. (-lim took the oldest lim,
  // which hid all new messages once a listener passed lim total.)
  // webhookUrl is excluded: rid is public via the share link, so this
  // endpoint must not expose owner-only settings.
  const user = await Listener.findOne(
    { rid },
    { messages: { $slice: lim }, webhookUrl: 0 }
  ).populate({
    path: 'messages',
    // $gte (not $gt) so a message sharing the cursor's exact timestamp can't
    // fall through the gap between two polls; clients dedup by _id.
    match: sinceDate ? { timestamp: { $gte: sinceDate } } : {},
    populate: [
      {
        path: 'image',
        model: 'Image',
        select: '-dataURI'
      },
      {
        // Ciphertext excluded here for the same reason as the image: a poll
        // returning up to `lim` full clips would balloon the response. The
        // client fetches + decrypts the real thing from /api/audio on play.
        path: 'audio',
        model: 'Audio',
        select: '-dataURI'
      }
    ]
  });
  if (user) {
    return json({ status: 200, body: user });
  }

  return json({ status: 404, body: 'Public key not found' });
}

export async function PATCH({ request }) {
  const { message, imageData, audioData, r: author, p: recipientId } = await request.json();

  // Everything here comes from an unauthenticated client: enforce shapes so
  // objects can't reach Mongoose queries, and keep payload sizes bounded.
  // Empty text is allowed at this point — a voice note or image can stand on
  // its own; the "must have SOME content" check happens once image/audio are
  // parsed below too.
  if (typeof message !== 'string' || message.length > MAX_MESSAGE_CHARS) {
    return json({ status: 400, body: 'Invalid message' });
  }
  if (typeof author !== 'string' || !RID_PATTERN.test(author)) {
    return json({ status: 400, body: 'Invalid author' });
  }
  if (typeof recipientId !== 'string' || !RID_PATTERN.test(recipientId)) {
    return json({ status: 400, body: 'Invalid recipient' });
  }

  const dataURI: unknown[] = Array.isArray(imageData?.dataURI) ? imageData.dataURI : [];
  if (
    dataURI.some((chunk) => typeof chunk !== 'string') ||
    dataURI.reduce((len: number, chunk) => len + (chunk as string).length, 0) > MAX_IMAGE_CHARS
  ) {
    return json({ status: 400, body: 'Invalid image' });
  }
  const sanitizedImage = {
    dataURI: dataURI as string[],
    blurhash:
      typeof imageData?.blurhash === 'string' && imageData.blurhash.length <= 200
        ? imageData.blurhash
        : '',
    nsfw: !!imageData?.nsfw
  };

  const audioChunks: unknown[] = Array.isArray(audioData?.dataURI) ? audioData.dataURI : [];
  if (
    audioChunks.some((chunk) => typeof chunk !== 'string') ||
    audioChunks.reduce((len: number, chunk) => len + (chunk as string).length, 0) >
      MAX_AUDIO_CHARS
  ) {
    return json({ status: 400, body: 'Invalid audio' });
  }
  const sanitizedAudio = {
    dataURI: audioChunks as string[],
    duration:
      typeof audioData?.duration === 'number' && Number.isFinite(audioData.duration)
        ? Math.min(Math.max(audioData.duration, 0), MAX_AUDIO_DURATION_SEC)
        : 0
  };

  if (!message && sanitizedImage.dataURI.length === 0 && sanitizedAudio.dataURI.length === 0) {
    return json({ status: 400, body: 'Message must include text, an image, or a voice note' });
  }

  try {
    const image = await saveImage(sanitizedImage);
    const audio = await saveAudio(sanitizedAudio);
    const newMessage = await createMessage(message, image?._id ?? null, audio?._id ?? null, author);
    const listener = await updateListenerWithMessage(recipientId, newMessage._id);

    if (listener?.webhookUrl) {
      await sendWebhookNotification(listener.webhookUrl, newMessage);
    }

    // Wake any live inbox watching this room so it re-fetches immediately
    // instead of waiting for its next poll. No-op if nobody is connected.
    if (listener) notifyRoom(recipientId);

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

  if (
    typeof pbKey !== 'string' ||
    !pbKey ||
    pbKey.length > MAX_PBKEY_CHARS ||
    typeof rid !== 'string' ||
    !RID_PATTERN.test(rid)
  )
    return json({ status: 400, body: 'Error saving listener : supply pbkey & rid' });

  try {
    await openpgp.readKey({ armoredKey: pbKey });
  } catch {
    return json({ status: 400, body: 'pbKey is not a valid armored PGP key' });
  }

  // A duplicate rid would let an attacker shadow an existing room with their
  // own key and hijack signed mutations; the schema's unique index on rid is
  // the hard guarantee behind this check.
  if (await Listener.exists({ rid })) {
    return json({ status: 409, body: 'rid already registered' });
  }

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
