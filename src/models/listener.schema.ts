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
  // Per-room abuse limits, all owner-set via the signed /api/limits endpoint.
  // Defaults are chosen so every pre-existing room behaves exactly as before:
  // not paused, images allowed, no length cap, no hourly cap.
  paused: { type: Boolean, default: false },
  // Images default ON (they predate this toggle), unlike voice which is
  // opt-in — an explicit `false` is what disables them (see roomLimits.ts).
  imagesEnabled: { type: Boolean, default: true },
  // 0 = no owner cap (the client's global 1000-char cap still applies).
  maxMessageLength: { type: Number, default: 0 },
  // At most `rateLimitCount` messages per `rateLimitPeriod` (minute|hour|day),
  // enforced by an in-memory window per room. count 0 = unlimited.
  rateLimitCount: { type: Number, default: 0 },
  rateLimitPeriod: { type: String, default: 'hour' },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  ],
  // Set when the owner deletes this identity. The row stays because `rid` and
  // `pbKey` have to: messages this identity sent to OTHER rooms are verified
  // against this key, and dropping the row would make every one of them fail
  // verification in somebody else's inbox rather than leaving them intact.
  // Everything else is unset (see identityDelete.ts), and this field is what
  // every read and every signed action checks to refuse a tombstone.
  deletedAt: { type: Date, default: null }
});

export default mongoose.models.Listener || mongoose.model('Listener', ListenerSchema);
