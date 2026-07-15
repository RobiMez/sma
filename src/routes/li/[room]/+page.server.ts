import { apiUrl } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, fetch }) => {
  const response = await fetch(apiUrl(`/api/profanity?rid=${encodeURIComponent(params.room)}`));

  const resp = await response.json();

  return { profanityFilterEnabled: resp.body?.profanityEnabled ?? false };
}) satisfies PageServerLoad;
