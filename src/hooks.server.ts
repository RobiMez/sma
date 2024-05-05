import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { dbConnect } from '$lib/db';
import { MODE } from '$env/static/private';

import type { Handle } from '@sveltejs/kit';

// const securityHeaders = {
//     'Cross-Origin-allow-origin': '*',
// };

Sentry.init({
  enabled: MODE !== 'development',
  dsn: 'https://2d59ea8dc270b68ae5300743a2adfeae@o879779.ingest.us.sentry.io/4507160073601024',
  tracesSampleRate: 1
});

dbConnect();
export const handleError = Sentry.handleErrorWithSentry();
export const handle: Handle = sequence(
  Sentry.sentryHandle()
  // , async ({ event, resolve }) => {
  //     const response = await resolve(event);
  //     Object.entries(securityHeaders).forEach(
  //         ([header, value]) => response.headers.set(header, value)
  //     );

  //     return response;
  // }
);
