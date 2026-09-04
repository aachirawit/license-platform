// Client-safe masking helpers (no server imports).

/** Mask an IP for display/logs: keep the network, drop the host. */
export function maskIp(ip: string | null | undefined): string {
  if (!ip) return "unknown";
  if (ip.includes(":")) {
    const groups = ip.split(":");
    return `${groups.slice(0, 2).join(":")}:••••`;
  }
  const octets = ip.split(".");
  return octets.length === 4 ? `${octets[0]}.${octets[1]}.•.•` : "••••";
}
