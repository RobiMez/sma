import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { sharedSentryOptions } from '$lib/sentry';

// Opt-in: no DSN, no SDK. Keeps forks, CI and local dev from reporting into
// someone else's project, and makes "is Sentry on?" a deploy-time decision
// rather than something baked into the bundle.
const dsn = env.PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    ...sharedSentryOptions,

    // No `replayIntegration()`, and it must stay that way. Session Replay
    // records the DOM, and by the time a message is on screen in /li/[room] it
    // has been decrypted — enabling replay would hand Sentry the plaintext
    // that this app goes to considerable trouble never to send anywhere. Same
    // reasoning retires DOM breadcrumbs, which describe the element a user
    // clicked and would be collected from inside message bubbles.
    integrations: [Sentry.breadcrumbsIntegration({ dom: false })]
  });
}

export const handleError = Sentry.handleErrorWithSentry();
