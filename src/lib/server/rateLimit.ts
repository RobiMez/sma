// In-memory fixed-window rate limiter, keyed by an arbitrary string
// (here: client IP + route bucket). Fixed-window is simple and predictable;
// its only downside is a burst of up to 2x the limit straddling a window
// boundary, which is fine for abuse prevention.
//
// State lives in the process, so this assumes SMA runs as a single long-lived
// Node server — the same assumption db.ts already makes with its cached
// mongoose connection. It does NOT coordinate across multiple instances; a
// horizontally-scaled deploy would need a shared store (e.g. Redis).

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
}

export class RateLimiter {
  private windows = new Map<string, Window>();
  private lastSweep = 0;

  // `now` is injectable so tests don't need fake timers.
  check(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
    this.maybeSweep(now);

    let window = this.windows.get(key);
    if (!window || now >= window.resetAt) {
      window = { count: 0, resetAt: now + windowMs };
      this.windows.set(key, window);
    }

    window.count++;

    if (window.count > limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil((window.resetAt - now) / 1000))
      };
    }

    return { allowed: true, remaining: limit - window.count, retryAfterSec: 0 };
  }

  // Amortized cleanup so the map doesn't grow unbounded as unique IPs churn.
  // Runs at most once a minute, dropping windows that have already expired.
  private maybeSweep(now: number) {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, window] of this.windows) {
      if (now >= window.resetAt) this.windows.delete(key);
    }
  }
}
