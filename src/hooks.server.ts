import { dbConnect } from '$lib/db';
import { json, type Handle } from '@sveltejs/kit';
import { RateLimiter } from '$lib/server/rateLimit';

dbConnect();

const limiter = new RateLimiter();
const MINUTE = 60_000;

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
    (pathname === '/api/title' || pathname === '/api/profanity' || pathname === '/api/webhook')
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

export const handle: Handle = async ({ event, resolve }) => {
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
        { status: 429, headers: { 'Retry-After': String(result.retryAfterSec) } }
      );
    }
  }

  return await resolve(event);
};
