import mongoose from 'mongoose';

const RoomSchema = new mongoose.Schema({
  pbKey: String,
  rid: String,
  profanityEnabled: { type: Boolean, default: false },
  messages: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message'
    }
  ]
});

export default mongoose.models.Room || mongoose.model('Room', RoomSchema);
