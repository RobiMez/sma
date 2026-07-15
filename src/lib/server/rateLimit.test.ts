import { describe, it, expect } from 'vitest';
import { RateLimiter } from './rateLimit';

describe('RateLimiter', () => {
  it('allows requests up to the limit, then blocks', () => {
    const rl = new RateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 5; i++) {
      expect(rl.check('ip:send', 5, 60_000, t0).allowed).toBe(true);
    }
    const blocked = rl.check('ip:send', 5, 60_000, t0);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('reports remaining budget', () => {
    const rl = new RateLimiter();
    expect(rl.check('ip:x', 3, 60_000, 0).remaining).toBe(2);
    expect(rl.check('ip:x', 3, 60_000, 0).remaining).toBe(1);
    expect(rl.check('ip:x', 3, 60_000, 0).remaining).toBe(0);
  });

  it('resets after the window elapses', () => {
    const rl = new RateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) rl.check('ip:send', 3, 60_000, t0);
    expect(rl.check('ip:send', 3, 60_000, t0).allowed).toBe(false);
    // One window later the counter is fresh.
    expect(rl.check('ip:send', 3, 60_000, t0 + 60_000).allowed).toBe(true);
  });

  it('tracks keys independently', () => {
    const rl = new RateLimiter();
    const t0 = 1_000_000;
    for (let i = 0; i < 3; i++) rl.check('ip-a:send', 3, 60_000, t0);
    expect(rl.check('ip-a:send', 3, 60_000, t0).allowed).toBe(false);
    // A different IP (or bucket) has its own budget.
    expect(rl.check('ip-b:send', 3, 60_000, t0).allowed).toBe(true);
    expect(rl.check('ip-a:register', 3, 60_000, t0).allowed).toBe(true);
  });

  it('computes Retry-After from time left in the window', () => {
    const rl = new RateLimiter();
    const t0 = 1_000_000;
    rl.check('ip:send', 1, 60_000, t0);
    const blocked = rl.check('ip:send', 1, 60_000, t0 + 20_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBe(40); // 60s window, 20s elapsed
  });
});
