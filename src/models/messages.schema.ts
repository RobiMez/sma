import mongoose from 'mongoose';

// A reply the room owner wrote back to whoever sent the parent message.
// Embedded rather than its own collection because a reply is only ever
// meaningful attached to one specific message — that scoping is the feature —
// and because both readers of a reply (the inbox poll and the sender's
// /api/sent list) already fetch the parent, so embedding costs them no extra
// round trip. `message` is armored ciphertext encrypted to the sender *and*
// the owner and signed by the owner; the server never sees the text.
const ReplySchema = new mongoose.Schema(
  {
    message: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: true }
);

const MessageSchema = new mongoose.Schema({
  message: { type: String, default: '' },
  author: { type: String, default: '' },
  image: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Image'
  },
  audio: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Audio'
  },
  timestamp: { type: Date, default: Date.now },
  // Set the first time the author edits this message (see PATCH /api/sent).
  // `timestamp` deliberately stays put so an edit never reorders the inbox or
  // jumps the poll cursor; this is the field incremental polls watch instead.
  // Absent on every message sent before editing existed, which reads as "never
  // edited" everywhere it's checked.
  editedAt: { type: Date, default: null },
  replies: { type: [ReplySchema], default: [] },
  // Bumped when a reply is appended, for the same reason `editedAt` exists:
  // `timestamp` must not move, so incremental polls need some field that does.
  // Without it an already-open second tab of the owner's inbox would never
  // learn about a reply written in the first one.
  repliedAt: { type: Date, default: null }
});

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
