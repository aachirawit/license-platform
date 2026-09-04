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

/** Mask an IP for display/logs: keep the network, drop the host. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  if (ip.includes(":")) {
    // IPv6: keep the first two groups.
    const groups = ip.split(":");
    return `${groups.slice(0, 2).join(":")}:••••`;
  }
  const octets = ip.split(".");
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.•.•` : "••••";
}
