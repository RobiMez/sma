import { apiUrl } from '$lib/api';
import type { PageServerLoad } from './$types';

export const load = (async ({ params, fetch }) => {
  const rid = encodeURIComponent(params.room);

  // Both are public reads, and neither blocks the other — fetch them together
  // rather than paying two serial round trips before the inbox renders.
  const [profanityResp, voiceResp] = await Promise.all([
    fetch(apiUrl(`/api/profanity?rid=${rid}`)).then((r) => r.json()),
    fetch(apiUrl(`/api/voice?rid=${rid}`)).then((r) => r.json())
  ]);

  return {
    profanityFilterEnabled: profanityResp.body?.profanityEnabled ?? false,
    // Voice is opt-in: anything other than an explicit `true` means off.
    voiceEnabled: voiceResp.body?.voiceEnabled ?? false
  };
}) satisfies PageServerLoad;
