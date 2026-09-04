import type { SecuritySeverity } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";
import { notifyDiscord } from "@/lib/discord/discord-service";

// Records a security event and, for high-signal ones, fans out a Discord alert.
// Recording must never throw into the calling flow (a login must succeed even
// if the security row or the webhook fails), so errors are logged and swallowed.

export type SecurityEventType =
  | "LOGIN_SUCCESS"
  | "LOGIN_FAILED"
  | "MULTIPLE_LOGIN_FAILURES"
  | "INVALID_LICENSE"
  | "HWID_MISMATCH"
  | "LICENSE_BANNED_ATTEMPT"
  | "LICENSE_EXPIRED_ATTEMPT"
  | "HWID_RESET"
  | "SUSPICIOUS_ACTIVITY";

export interface SecurityEventInput {
  type: SecurityEventType;
  severity: SecuritySeverity;
  appId?: string | null;
  licensePrefix?: string | null;
  ip?: string | null;
  message: string;
  metadata?: Record<string, unknown>;
  /** When true, also post a Discord alert (fire-and-forget). */
  alert?: boolean;
}

export async function recordSecurityEvent(input: SecurityEventInput): Promise<void> {
  try {
    await prisma.securityEvent.create({
      data: {
        type: input.type,
        severity: input.severity,
        appId: input.appId ?? null,
        licensePrefix: input.licensePrefix ?? null,
        ip: input.ip ?? null,
        message: input.message,
        metadata: (input.metadata ?? undefined) as object | undefined,
      },
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), type: input.type },
      "security_event_write_failed",
    );
  }

  if (input.alert) {
    // Not awaited: the alert must not delay or fail the request.
    void notifyDiscord({
      type: input.type,
      severity: input.severity,
      appId: input.appId ?? undefined,
      licensePrefix: input.licensePrefix ?? undefined,
      ip: input.ip ?? undefined,
      message: input.message,
    });
  }
}
