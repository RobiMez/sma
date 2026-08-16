import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import { verifySignedAction } from '$lib/server/signedAction';
import { parseEditParams, parseRoomParam, checkEditable } from '$lib/server/messageEdit';
import { notifyRoom } from '$lib/server/wsRegistry.js';

// The sender's own history, newest first. Deliberately bounded: each entry
// carries full armored ciphertext (the point of the endpoint — the sender
// decrypts it locally), so this is a much fatter response per row than the
// inbox poll.
const SENT_LIMIT = 50;

/**
 * List the messages an identity sent to a room.
 *
 * A read behind POST, because it has to be authorized and every signed
 * request in this app carries its signature in the body (see `signedFetch`).
 * It can't be a public GET keyed on rid: the rid is public — it's in the
 * share link — so a GET would let anyone enumerate who has been writing to a
 * room, how often, and when. The ciphertext would stay unreadable, but the
 * metadata wouldn't. The signature proves the caller holds the private key
 * for the author rid, which is the only thing that should unlock this.
 */
export async function POST({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'sent:list');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const room = parseRoomParam(verdict.params.room);
  if (!room) return json({ status: 400, body: 'Invalid room' });

  try {
    const roomDoc = await Listener.findOne({ rid: room }, { messages: 1 });
    if (!roomDoc) return json({ status: 404, body: 'Room not found' });

    // Filtering the room's own ref array (rather than querying Message by
    // author alone) keeps this scoped to one room, and the $in narrows the
    // scan even though `author` isn't indexed. dataURI is excluded for the
    // same reason the inbox excludes it — the sender's list only needs to
    // know an attachment is there, not carry it.
    const messages = await Message.find({
      _id: { $in: roomDoc.messages },
      author: verdict.listener.rid
    })
      .sort({ timestamp: -1 })
      .limit(SENT_LIMIT)
      .populate({ path: 'image', model: 'Image', select: '-dataURI' })
      .populate({ path: 'audio', model: 'Audio', select: '-dataURI' });

    return json({ status: 200, body: { messages } });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching sent messages' });
  }
}

/**
 * Replace the text of a message you sent. The new value is armored ciphertext
 * the client produced exactly like an original send (encrypted to recipient
 * *and* author, signed by the author) — the server just swaps the blob and
 * stamps `editedAt`.
 */
export async function PATCH({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'message:edit');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const parsed = parseEditParams(verdict.params);
  if (!parsed.ok) return json({ status: parsed.status, body: parsed.message });
  const { id, room, message: newMessage } = parsed.value;

  try {
    // Requiring the message to be in the room the client named does two jobs:
    // it hands us the rid to ping over the WebSocket without scanning every
    // listener, and it stops a message id from one room being edited through
    // another room's endpoint.
    const roomDoc = await Listener.findOne({ rid: room, messages: id }, { rid: 1 });
    if (!roomDoc) return json({ status: 404, body: 'Message not found in this room' });

    const message = await Message.findById(id);
    const editable = checkEditable(message, verdict.listener.rid, newMessage);
    if (!editable.ok) return json({ status: editable.status, body: editable.message });

    message.message = newMessage;
    message.editedAt = new Date();
    await message.save();

    // Same ping a new message sends: an open inbox re-fetches and re-decrypts
    // this one instead of showing the old text until the next reload.
    notifyRoom(room);

    return json({ status: 200, body: { id, editedAt: message.editedAt } });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error updating message' });
  }
}
