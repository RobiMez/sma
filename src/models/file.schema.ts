import mongoose from 'mongoose';

const ImageFileSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  dataURI: [{ type: String, default: '' }],
  blurhash: { type: String, default: '' },
  nsfw: { type: Boolean, default: false }
});

export default mongoose.models.Image || mongoose.model('Image', ImageFileSchema);
