import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { Errors } from "./errors";
import { logger } from "@/lib/logger";

// Rate limiting with two backends behind one async call.
//
// - GLOBAL (preferred): when UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//   are set, counters live in Upstash Redis, shared across every serverless
//   instance. This is the accurate limit - a burst spread over many Vercel
//   instances is still counted as one.
// - IN-PROCESS (fallback): with no Upstash configured, each instance keeps its
//   own counters. A real defence-in-depth ceiling, but per-instance, so it is
//   looser under scale. Keeps local dev and un-provisioned deploys working.
//
// The signature is async so callers `await rateLimit(...)`; the throw on limit
// is the same in both paths, handled by toErrorResponse.

export interface RateLimitRule {
  /** Distinct namespace, e.g. "login" or "generate". */
  name: string;
  limit: number;
  windowMs: number;
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

// ── Upstash (global) ──────────────────────────────────────────────────────────

let limiters: Map<string, Ratelimit> | null | undefined;

function upstashLimiters(): Map<string, Ratelimit> | null {
  if (limiters !== undefined) return limiters;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    limiters = null; // not configured; use the in-process fallback
    return null;
  }

  const redis = new Redis({ url, token });
  const map = new Map<string, Ratelimit>();
  for (const rule of Object.values(RULES)) {
    map.set(
      rule.name,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(rule.limit, `${rule.windowMs} ms`),
        prefix: `rl:${rule.name}`,
        analytics: false,
      }),
    );
  }
  limiters = map;
  return map;
}

// ── In-process (fallback) ─────────────────────────────────────────────────────

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

function rateLimitInProcess(rule: RateLimitRule, identifier: string): void {
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
    throw Errors.rateLimited(`Too many requests. Try again in ${Math.ceil(retryMs / 1000)}s.`);
  }

  bucket.count += 1;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Consume one unit for `identifier` under `rule`. Throws RATE_LIMITED when the
 * window is exhausted. `identifier` is typically the client IP, or the admin id
 * for authenticated mutations. Uses Upstash when configured, else in-process.
 */
export async function rateLimit(rule: RateLimitRule, identifier: string): Promise<void> {
  const global = upstashLimiters();
  const limiter = global?.get(rule.name);

  if (limiter) {
    let result: { success: boolean; reset: number };
    try {
      result = await limiter.limit(identifier);
    } catch (err) {
      // The rate limiter must NEVER take down the API. If Upstash is misconfigured
      // (e.g. a bad token) or unreachable, log it and fall back to the in-process
      // limiter so requests still get a per-instance ceiling instead of a 500.
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), rule: rule.name },
        "ratelimit_upstash_error_fallback",
      );
      rateLimitInProcess(rule, identifier);
      return;
    }

    if (!result.success) {
      const retryMs = Math.max(0, result.reset - Date.now());
      throw Errors.rateLimited(`Too many requests. Try again in ${Math.ceil(retryMs / 1000)}s.`);
    }
    return;
  }

  rateLimitInProcess(rule, identifier);
}
