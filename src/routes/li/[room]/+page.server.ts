import { apiUrl } from '$lib/api';
import type { PageServerLoad } from './$types';

// Neither of these is essential to rendering the inbox — they only decide how
// two toggles start out. So a settings read that fails (endpoint down, a
// non-JSON error page, a network blip) must not take the whole message list
// with it: throwing here would replace the inbox with an error page. Each read
// degrades to its own safe default instead, independently of the other.
const readRoomFlag = async (
  fetchFn: typeof fetch,
  path: string
): Promise<Record<string, unknown> | null> => {
  try {
    const resp = await fetchFn(apiUrl(path)).then((r) => r.json());
    // `{ status, body }` envelope — a 404 (room not registered yet) is a
    // normal answer here, not an error worth logging.
    return resp?.status === 200 ? resp.body : null;
  } catch (e) {
    console.error('Failed to read room setting', path, e);
    return null;
  }
};

export const load = (async ({ params, fetch }) => {
  const rid = encodeURIComponent(params.room);

  // Independent reads — fetch them together rather than paying two serial
  // round trips before the inbox renders.
  const [profanity, voice] = await Promise.all([
    readRoomFlag(fetch, `/api/profanity?rid=${rid}`),
    readRoomFlag(fetch, `/api/voice?rid=${rid}`)
  ]);

  return {
    profanityFilterEnabled: profanity?.profanityEnabled === true,
    // Voice is opt-in: anything other than an explicit `true` means off.
    voiceEnabled: voice?.voiceEnabled === true
  };
}) satisfies PageServerLoad;
