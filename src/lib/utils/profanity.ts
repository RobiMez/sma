import { apiUrl } from '$lib/api';

export interface IVectorResponse {
  flaggedFor?: string;
  isProfanity: boolean;
  score: number;
}

/**
 * Whether this room allows profanity. The flag is named for what it permits:
 * `profanityEnabled: true` means "don't bother checking".
 *
 * Honor-system by construction — the server only ever holds ciphertext, so it
 * can't enforce this; a modified client skips the check trivially. Fails
 * closed (checks) if the setting can't be read.
 */
export const fetchProfanityAllowed = async (rid: string): Promise<boolean> => {
  const response = await fetch(apiUrl(`/api/profanity?rid=${encodeURIComponent(rid)}`));
  const re = await response.json();

  if (re.status !== 200) {
    console.error('Failed to fetch profanity setting:', re.body);
    return false;
  }
  return !!re.body.profanityEnabled;
};

/** {"isProfanity":true,"score":0.99999964,"flaggedFor":"Fuck"} */
export const checkProfanity = async (message: string): Promise<IVectorResponse> => {
  const res = await fetch('https://vector.profanity.dev', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });

  return (await res.json()) as IVectorResponse;
};
