import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

// Writes an audit row for a sensitive admin action. Audit is append-only at the
// application layer: nothing in the codebase updates or deletes these rows.
// A webhook failure or a Discord outage must never block the action, so this
// swallows its own errors after logging them.

export interface AuditInput {
  adminId: string | null;
  action: string;
  appId?: string | null;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export async function writeAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: input.adminId,
        action: input.action,
        appId: input.appId ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? undefined) as object | undefined,
        ip: input.ip ?? null,
        userAgent: input.userAgent?.slice(0, 300) ?? null,
      },
    });
  } catch (err) {
    logger.error(
      { err: err instanceof Error ? err.message : String(err), action: input.action },
      "audit_write_failed",
    );
  }
}
