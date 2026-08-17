import { json } from '@sveltejs/kit';
import Listener from '../../../models/listener.schema';
import Message from '../../../models/messages.schema';
import { verifySignedAction } from '$lib/server/signedAction';
import { parseReplyParams, checkReplyable } from '$lib/server/messageReply';
import { notifyRoom } from '$lib/server/wsRegistry.js';

/**
 * Reply to one specific message in your room.
 *
 * Signature-authorized like every other mutation here, but note *whose*
 * signature: the room owner's. `verifySignedAction` only establishes that the
 * caller controls the rid they claim, so requiring `room === signer` is what
 * actually makes this owner-only — see `checkReplyable`.
 *
 * The reply body is armored ciphertext the client encrypted to the sender
 * *and* to the owner and signed with the owner's key. Encrypting to both is
 * what lets the owner still read their own side of the thread; signing is what
 * lets the sender tell a real reply from a row someone wrote straight into the
 * database. The server checks neither — it can't, it only ever sees armor —
 * so the sender's client verifies the signature before displaying anything,
 * exactly as the inbox does for incoming messages.
 */
export async function POST({ request }) {
  const verdict = await verifySignedAction(await request.json(), 'message:reply');
  if (!verdict.ok) return json({ status: verdict.status, body: verdict.message });

  const parsed = parseReplyParams(verdict.params);
  if (!parsed.ok) return json({ status: parsed.status, body: parsed.message });
  const { id, room, message: replyText } = parsed.value;

  // Cheap and free of DB access, and it decides the 403 that must not depend
  // on whether the message exists — so run it before any lookup.
  const ownerCheck = checkReplyable({ replies: [] }, verdict.listener.rid, room);
  if (!ownerCheck.ok) return json({ status: ownerCheck.status, body: ownerCheck.message });

  try {
    // Same containment check the edit path does: the message has to actually
    // be in this room, so an id copied out of somewhere else can't be replied
    // to through here.
    const roomDoc = await Listener.findOne({ rid: room, messages: id }, { rid: 1 });
    if (!roomDoc) return json({ status: 404, body: 'Message not found in this room' });

    const message = await Message.findById(id);
    const replyable = checkReplyable(message, verdict.listener.rid, room);
    if (!replyable.ok) return json({ status: replyable.status, body: replyable.message });

    const timestamp = new Date();
    message.replies.push({ message: replyText, timestamp });
    // `timestamp` stays where it is for the same reason an edit leaves it
    // alone — it's the inbox's sort key and poll cursor. This is the field
    // incremental polls match on instead (see GET /api/pgp).
    message.repliedAt = timestamp;
    await message.save();
    const saved = message.replies[message.replies.length - 1];

    // Wake the sender's page so the reply lands without a reload. Their own
    // rid is a registered listener too (every identity is), so it has a
    // WebSocket room of its own to ping — the same mechanism, pointed the
    // other way down the conversation.
    if (message.author) notifyRoom(message.author);
    // And the owner's other tabs, which are watching the room itself. Skipped
    // when they're the same rid (replying to yourself in your own room).
    if (room !== message.author) notifyRoom(room);

    // `replyId` is the subdocument's own id, and the client needs it: the
    // notifyRoom ping above fires while this request is still in flight, so
    // the caller's own inbox may fold this reply in from a poll *before* it
    // sees this response. Without a stable id to dedupe on it would render
    // twice.
    return json({
      status: 200,
      body: {
        id,
        replyId: String(saved?._id ?? ''),
        timestamp,
        repliedAt: message.repliedAt
      }
    });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error saving reply' });
  }
}
