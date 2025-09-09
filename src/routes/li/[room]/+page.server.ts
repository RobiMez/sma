import { page } from '$app/state';
import type { PageServerLoad } from './$types';

export const load = (async ({ params,fetch }) => {
    const response = await fetch('/api/profanity', {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rid: params.room })
    });

    const resp = await response.json();

    return { profanityFilterEnabled: resp.body.profanityEnabled };
}) satisfies PageServerLoad;