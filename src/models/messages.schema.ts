import mongoose from 'mongoose';

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
  editedAt: { type: Date, default: null }
});

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
