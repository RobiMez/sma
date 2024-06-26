import { json } from '@sveltejs/kit';

import Image from '../../../models/file.schema';

export async function GET({ url }) {
  const id = url.searchParams.get('id') ?? '';

  try {
    const image = await Image.findOne({ _id: id });
    if (image) {
      return json({ status: 200, body: image });
    }

    return json({ status: 404, body: 'Image not found' });
  } catch (error) {
    console.error(error);
    return json({ status: 500, body: 'Error fetching image' });
  }
}
