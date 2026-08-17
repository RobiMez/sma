import * as Sentry from '@sentry/sveltekit';
import { dbConnect } from '$lib/db';
import { json, type Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { RateLimiter } from '$lib/server/rateLimit';
import { sharedSentryOptions } from '$lib/sentry';

// Same opt-in as the client, and the same DSN — it's a public ingest key.
if (publicEnv.PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: publicEnv.PUBLIC_SENTRY_DSN,
    ...sharedSentryOptions
  });
}

dbConnect();

const limiter = new RateLimiter();
const MINUTE = 60_000;

// The Vercel frontend calls this box cross-origin, so /api needs CORS.
// CORS_ORIGINS is a comma-separated allowlist (e.g. the Vercel domain[s]).
// Empty or "*" reflects any Origin — acceptable here because the API is either
// public or signature-authenticated, never cookie/origin-trusted.
const CORS_ALLOWLIST = (env.CORS_ORIGINS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (CORS_ALLOWLIST.length === 0 || CORS_ALLOWLIST.includes('*')) return origin;
  return CORS_ALLOWLIST.includes(origin) ? origin : null;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin'
  };
}

interface Rule {
  bucket: string;
  limit: number;
  windowMs: number;
}

// Per-IP request budgets. Buckets are independent, so sending messages never
// eats into the settings-mutation budget, etc. Reads/polling fall through to
// the broad `api` backstop. Limits are sized to be invisible to a real user
// (a chatty human sends << 30 msgs/min) while stopping scripted floods, which
// run orders of magnitude above any of these.
function ruleFor(method: string, pathname: string): Rule | null {
  // Anonymous message send — the main flood vector.
  if (pathname === '/api/pgp' && method === 'PATCH') {
    return { bucket: 'send', limit: 30, windowMs: MINUTE };
  }
  // Listener registration — each call persists a new keypair.
  if (pathname === '/api/pgp' && method === 'POST') {
    return { bucket: 'register', limit: 10, windowMs: MINUTE };
  }
  // Signed owner mutations — each does a CPU-heavy PGP verify even when it
  // ultimately 403s, so cap them regardless of outcome.
  if (
    method !== 'GET' &&
    (pathname === '/api/title' ||
      pathname === '/api/profanity' ||
      pathname === '/api/webhook' ||
      pathname === '/api/voice' ||
      // Both verbs: /api/sent's list is a POST, not a GET, because it's
      // signature-authorized like the rest of this bucket.
      pathname === '/api/sent' ||
      pathname === '/api/reply')
  ) {
    return { bucket: 'mutate', limit: 30, windowMs: MINUTE };
  }
  // Broad backstop for everything else under /api (inbox polling, stats,
  // public reads). Generous enough that normal polling never trips it.
  if (pathname.startsWith('/api/')) {
    return { bucket: 'api', limit: 240, windowMs: MINUTE };
  }
  return null;
}

const appHandle: Handle = async ({ event, resolve }) => {
  const isApi = event.url.pathname.startsWith('/api/');
  const cors = isApi ? allowedOrigin(event.request.headers.get('origin')) : null;

  // CORS preflight — answer before rate limiting or route logic.
  if (isApi && event.request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors ? corsHeaders(cors) : {} });
  }

  const rule = ruleFor(event.request.method, event.url.pathname);
  if (rule) {
    let ip = 'unknown';
    try {
      ip = event.getClientAddress();
    } catch {
      // Adapter can't resolve the address (e.g. proxy header not configured).
      // Fall back to a shared key rather than failing open.
    }

    const result = limiter.check(`${ip}:${rule.bucket}`, rule.limit, rule.windowMs);
    if (!result.allowed) {
      // Real 429 so proxies/clients honour Retry-After, plus the app's
      // { status, body } envelope for callers that read the JSON.
      return json(
        { status: 429, body: 'Too many requests, please slow down.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(result.retryAfterSec),
            ...(cors ? corsHeaders(cors) : {})
          }
        }
      );
    }
  }

  const response = await resolve(event);
  if (cors) {
    for (const [key, value] of Object.entries(corsHeaders(cors))) {
      response.headers.set(key, value);
    }
  }
  return response;
};

// Sentry first so a request that the app handler rejects (429, CORS preflight)
// still gets traced, and so errors thrown further down are attributed to a
// request rather than to nothing.
export const handle: Handle = sequence(Sentry.sentryHandle(), appHandle);

export const handleError = Sentry.handleErrorWithSentry();
