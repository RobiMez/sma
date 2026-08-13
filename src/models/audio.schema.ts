import mongoose from 'mongoose';

const AudioSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  // Armored PGP ciphertext of the (already voice-disguised) recording,
  // chunked into an array like Image.dataURI. Unlike images, this is
  // genuinely opaque without the recipient's private key — chunking here is
  // purely a storage convenience, not the only privacy this data gets.
  dataURI: [{ type: String, default: '' }],
  duration: { type: Number, default: 0 }
});

export default mongoose.models.Audio || mongoose.model('Audio', AudioSchema);
