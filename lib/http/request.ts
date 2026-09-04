import type { NextRequest } from "next/server";

// Server-derived request facts. Security-sensitive values (IP especially) are
// read here from the request, never trusted from the JSON body.

/**
 * Best-effort client IP. On Vercel the real client is in x-forwarded-for (first
 * hop); x-real-ip is a fallback. Returns null rather than a bogus value when
 * absent, so callers can decide how to handle it.
 */
export function clientIp(req: NextRequest): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip");
}

export function userAgent(req: NextRequest): string | null {
  return req.headers.get("user-agent");
}

export { maskIp } from "@/lib/mask";
