import { Errors } from "./errors";

// A small fixed-window rate limiter.
//
// It is intentionally in-process: the platform targets Vercel + Neon with no
// Redis, per the brief. Each serverless instance keeps its own counters, so
// this is a per-instance guard - a real defence-in-depth ceiling for brute
// force and spam, not a globally exact quota. For login specifically, the
// database-backed failed-attempt lock in the auth service is the authoritative
// control; this limiter blunts volume before it reaches that logic.
//
// When the platform later needs a global limit (multiple instances), swap this
// module's implementation for a Redis/Upstash store behind the same signature.

interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();

// Opportunistic cleanup so the map cannot grow without bound on a long-lived
// instance; runs at most once per sweep window.
let lastSweep = 0;
function sweep(now: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) store.delete(key);
  }
}

export interface RateLimitRule {
  /** Distinct namespace, e.g. "login" or "generate". */
  name: string;
  limit: number;
  windowMs: number;
}

/**
 * Consume one unit for `identifier` under `rule`. Throws RATE_LIMITED when the
 * window is exhausted. `identifier` is typically the client IP, or IP+email for
 * login so one noisy network cannot lock out everyone.
 */
export function rateLimit(rule: RateLimitRule, identifier: string): void {
  const now = Date.now();
  sweep(now);

  const key = `${rule.name}:${identifier}`;
  const bucket = store.get(key);

  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + rule.windowMs });
    return;
  }

  if (bucket.count >= rule.limit) {
    const retryMs = bucket.resetAt - now;
    throw Errors.rateLimited(
      `Too many requests. Try again in ${Math.ceil(retryMs / 1000)}s.`,
    );
  }

  bucket.count += 1;
}

// Standard rules. Login is strict; reads are loose.
export const RULES = {
  login: { name: "login", limit: 8, windowMs: 5 * 60_000 },
  generate: { name: "generate", limit: 20, windowMs: 60_000 },
  mutation: { name: "mutation", limit: 60, windowMs: 60_000 },
  read: { name: "read", limit: 240, windowMs: 60_000 },
  // Public, unauthenticated key activation. Kept tight per IP to blunt key
  // brute-forcing; a legitimate client activates only occasionally.
  activate: { name: "activate", limit: 30, windowMs: 5 * 60_000 },
} satisfies Record<string, RateLimitRule>;
