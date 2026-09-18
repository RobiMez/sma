import { json } from '@sveltejs/kit';
import * as openpgp from 'openpgp';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import Image from '../../../models/file.schema';
import Audio from '../../../models/audio.schema';
import { isSafeWebhookUrl } from '$lib/server/webhookGuard';
import { checkSendGate, checkRoomRate } from '$lib/server/roomLimits';
import { notifyRoom } from '$lib/server/wsRegistry.js';
import { verifySignedAction } from '$lib/server/signedAction';
import { deletionUpdate, isDeleted } from '$lib/server/identityDelete';

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
    // editedAt and repliedAt are matched alongside it because neither an edit
    // nor a reply moves the message's original timestamp — without these arms,
    // a change to anything older than the client's cursor would never be
    // handed to an already-open inbox.
    match: sinceDate
      ? {
          $or: [
            { timestamp: { $gte: sinceDate } },
            { editedAt: { $gte: sinceDate } },
            { repliedAt: { $gte: sinceDate } }
          ]
        }
      : {},
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
  // A tombstone answers with its public key and nothing else.
  //
  // Not a 404, and this is the one place that is worth spelling out. This
  // endpoint has two callers with opposite needs: the send page asks "can I
  // write to this room", and an inbox asks "whose key verifies this message I
  // already have". 404ing a deleted rid would answer the first correctly and
  // break the second, silently turning every message that identity ever sent
  // into an unverifiable spoof in somebody else's inbox. So the key is
  // served, the room is not, and `deleted` says which is which. The send page
  // fails closed on that flag; PATCH refuses the send regardless.
  if (user && isDeleted(user)) {
    return json({
      status: 200,
      body: { rid: user.rid, pbKey: user.pbKey, deleted: true, messages: [] }
    });
  }
  if (user) {
    return json({ status: 200, body: user });
  }

  return json({ status: 404, body: 'Public key not found' });
}

// Delete an identity: the messages it holds, and every setting it ever had.
//
// Signature-authorized like every owner mutation, which here is the whole
// authorization story: holding the private key IS owning the room, so the one
// party who can ask for this is the one whose room it is.
//
// What it does NOT touch is the point worth keeping straight. Messages this
// identity sent to other people's rooms stay where they are: those belong to
// the inboxes that received them, and a delete button that reached into other
// people's rooms would be a retraction button wearing a different hat. The
// row itself survives as a tombstone for the same reason (see
// identityDelete.ts) so those messages keep verifying.
export async function DELETE({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'identity:delete');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const { listener } = verdict;
  const messageIds = (listener.messages ?? []).map((id: unknown) => id);

  try {
    if (messageIds.length) {
      // Read the attachments before the messages that point at them, or the
      // ids are gone and the blobs are orphaned in the database forever.
      const docs = await Message.find({ _id: { $in: messageIds } }, { image: 1, audio: 1 });
      const images = docs.map((d) => d.image).filter(Boolean);
      const audio = docs.map((d) => d.audio).filter(Boolean);
      if (images.length) await Image.deleteMany({ _id: { $in: images } });
      if (audio.length) await Audio.deleteMany({ _id: { $in: audio } });
      await Message.deleteMany({ _id: { $in: messageIds } });
    }

    await Listener.updateOne(
      { rid: listener.rid },
      deletionUpdate(Object.keys(Listener.schema.paths))
    );
    return json({ status: 200, body: { deleted: true, messages: messageIds.length } });
  } catch (error) {
    console.error('Failed to delete an identity', error);
    return json({ status: 500, body: 'Could not delete that identity' });
  }
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
    audioChunks.reduce((len: number, chunk) => len + (chunk as string).length, 0) > MAX_AUDIO_CHARS
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
    // Per-room limits, checked before anything is written so a rejected send
    // never lands a doc anywhere (this also stops the old behavior where a
    // send to a nonexistent room created an orphan Message first). The server
    // can't police message text — it only ever sees ciphertext — but paused,
    // an attached image/audio blob, and gross ciphertext size are all plainly
    // visible, so those it enforces for real (see roomLimits.ts).
    const recipient = await Listener.findOne(
      { rid: recipientId },
      {
        paused: 1,
        imagesEnabled: 1,
        voiceEnabled: 1,
        maxMessageLength: 1,
        rateLimitCount: 1,
        rateLimitPeriod: 1,
        deletedAt: 1
      }
    );
    // A deleted room is gone as far as senders are concerned. Checked here
    // with the rest of the gate, before anything is written, so a send to a
    // tombstone cannot leave an orphan Message behind.
    if (!recipient || isDeleted(recipient)) {
      return json({ status: 404, body: 'Listener not found' });
    }

    const gate = checkSendGate(recipient, {
      hasImage: sanitizedImage.dataURI.length > 0,
      hasAudio: sanitizedAudio.dataURI.length > 0,
      ciphertextLength: message.length
    });
    if (!gate.ok) return json({ status: gate.status, body: gate.message });

    // Last, after every other check: consulting the window counts this send
    // against the room's hourly budget, and a send rejected above shouldn't.
    const rate = checkRoomRate(recipientId, recipient.rateLimitCount, recipient.rateLimitPeriod);
    if (rate && !rate.allowed) {
      return json({
        status: 429,
        body: 'This room has hit its message limit for now. Try again later.'
      });
    }

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
