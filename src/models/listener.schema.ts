import mongoose from 'mongoose';

const ListenerSchema = new mongoose.Schema({
  pbKey: String,
  // Unique: a second listener with the same rid could shadow the original
  // and hijack signature-authenticated mutations.
  rid: { type: String, unique: true },
  title: String,
  webhookUrl: String,
  profanityEnabled: { type: Boolean, default: false },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  ]
});

export default mongoose.models.Listener || mongoose.model('Listener', ListenerSchema);
