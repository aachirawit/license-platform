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

// ── Read side (Security page) ─────────────────────────────────────────────────

export interface SecurityEventDto {
  id: string;
  type: string;
  severity: SecuritySeverity;
  appId: string | null;
  appName: string | null;
  licensePrefix: string | null;
  ip: string | null;
  message: string;
  createdAt: string;
}

export interface SecurityFilters {
  severity?: SecuritySeverity;
  type?: string;
  appId?: string;
  days: number;
  page: number;
  pageSize: number;
}

export async function listSecurityEvents(filters: SecurityFilters): Promise<{
  events: SecurityEventDto[];
  total: number;
  pageCount: number;
}> {
  const since = new Date(Date.now() - filters.days * 86_400_000);
  const where = {
    createdAt: { gte: since },
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.appId ? { appId: filters.appId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.pageSize,
      skip: (filters.page - 1) * filters.pageSize,
      include: { app: { select: { name: true } } },
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return {
    events: rows.map((r) => ({
      id: r.id,
      type: r.type,
      severity: r.severity,
      appId: r.appId,
      appName: r.app?.name ?? null,
      licensePrefix: r.licensePrefix,
      ip: r.ip,
      message: r.message,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
