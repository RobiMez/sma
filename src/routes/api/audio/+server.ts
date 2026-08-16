import { json } from '@sveltejs/kit';

import Audio from '../../../models/audio.schema';

// Mirrors /api/images: the inbox list omits the ciphertext (see the
// `-dataURI` populate exclusion in /api/pgp) so polling stays cheap, and the
// client fetches the full encrypted clip here only when it's actually played.
export async function GET({ url }) {
  const id = url.searchParams.get('id') ?? '';

  try {
    const audio = await Audio.findOne({ _id: id });
    if (audio) {
      return json({ status: 200, body: audio });
    }

    return json({ status: 404, body: 'Audio not found' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching audio' });
  }
}
