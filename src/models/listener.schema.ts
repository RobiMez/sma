import mongoose from 'mongoose';

const ListenerSchema = new mongoose.Schema({
  pbKey: String,
  // Unique: a second listener with the same rid could shadow the original
  // and hijack signature-authenticated mutations.
  rid: { type: String, unique: true },
  title: String,
  webhookUrl: String,
  profanityEnabled: { type: Boolean, default: false },
  // Voice notes are opt-in per room: `false` (the default, and what every
  // pre-existing room reads as) means the room accepts text and images only.
  // Unlike profanityEnabled this is genuinely enforced server-side — the
  // server can't see message plaintext, but it can plainly see whether an
  // audio blob is attached (see PATCH /api/pgp).
  voiceEnabled: { type: Boolean, default: false },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  ]
});

export default mongoose.models.Listener || mongoose.model('Listener', ListenerSchema);
