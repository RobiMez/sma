import mongoose from 'mongoose';

const ListenerSchema = new mongoose.Schema({
  pbKey: String,
  rid: String,
  messages: [{ type: mongoose.Schema.Types.Mixed, default: [] }]
});

export default mongoose.models.Listener || mongoose.model('Listener', ListenerSchema);