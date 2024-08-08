import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  pbKey: String,
  rid: String,
  profanityEnabled: { type: Boolean, default: false },
  slowMode: { type: Number, default: 0 }, // slow mode delay in seconds
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  ]
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
