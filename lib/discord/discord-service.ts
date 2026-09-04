import type { SecuritySeverity } from "@prisma/client";

import { logger } from "@/lib/logger";
import { maskIp } from "@/lib/http/request";

// Server-side Discord alerts. The webhook URL comes from an environment
// variable and NEVER reaches the browser. Alerts are optional: with no URL set,
// this is a no-op. A webhook failure is logged and swallowed - it must never
// break an authentication or admin action.
//
// The message deliberately omits every secret: no full licence key, no full
// HWID, no session token, no personal data. Only a masked prefix and a masked
// IP go out.

export interface DiscordAlert {
  type: string;
  severity: SecuritySeverity;
  appId?: string;
  licensePrefix?: string;
  ip?: string;
  message: string;
}

const SEVERITY_COLOR: Record<SecuritySeverity, number> = {
  LOW: 0x64_74_8b, // slate
  MEDIUM: 0xf5_9e_0b, // amber
  HIGH: 0xef_44_44, // red
};

const SEVERITY_ICON: Record<SecuritySeverity, string> = {
  LOW: "🔹",
  MEDIUM: "⚠️",
  HIGH: "🚨",
};

export async function notifyDiscord(alert: DiscordAlert): Promise<void> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return; // alerts disabled

  const embed = {
    title: `${SEVERITY_ICON[alert.severity]} ${alert.type}`,
    color: SEVERITY_COLOR[alert.severity],
    fields: [
      { name: "Severity", value: alert.severity, inline: true },
      { name: "App", value: alert.appId ?? "—", inline: true },
      { name: "License", value: alert.licensePrefix ? `${alert.licensePrefix}-••••` : "—", inline: true },
      { name: "IP", value: maskIp(alert.ip), inline: true },
      { name: "Detail", value: alert.message.slice(0, 500) },
    ],
    timestamp: new Date().toISOString(),
  };

  // Two attempts with a short timeout. A 429 from Discord is respected once via
  // its retry_after; anything else just gives up quietly.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));

      if (res.status === 429) {
        const body = (await res.json().catch(() => null)) as { retry_after?: number } | null;
        const waitMs = Math.min((body?.retry_after ?? 1) * 1000, 5000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (!res.ok) {
        logger.warn({ status: res.status, type: alert.type }, "discord_webhook_non_ok");
      }
      return;
    } catch (err) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), type: alert.type },
        "discord_webhook_error",
      );
      return;
    }
  }
}
