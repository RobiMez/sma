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
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.models.Message || mongoose.model('Message', MessageSchema);
