import mongoose from 'mongoose';

const ListenerSchema = new mongoose.Schema({
  pbKey: String,
  rid: String,
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
