import { dbConnect } from '$lib/db';
import type { Handle } from '@sveltejs/kit';

dbConnect();

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};
