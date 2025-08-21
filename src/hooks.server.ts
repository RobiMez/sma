import { sequence } from '@sveltejs/kit/hooks';
import * as Sentry from '@sentry/sveltekit';
import { dbConnect } from '$lib/db';
import { dev } from '$app/environment';

import type { Handle } from '@sveltejs/kit';

Sentry.init({
  enabled: !dev,
  dsn: 'https://2d59ea8dc270b68ae5300743a2adfeae@o879779.ingest.us.sentry.io/4507160073601024',
  tracesSampleRate: 1
});

dbConnect();
export const handleError = Sentry.handleErrorWithSentry();
export const handle: Handle = sequence(Sentry.sentryHandle());
