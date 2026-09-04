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

// ── Read side (Audit Logs page) ───────────────────────────────────────────────

export interface AuditLogDto {
  id: string;
  action: string;
  adminName: string | null;
  appName: string | null;
  targetType: string | null;
  targetId: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AuditFilters {
  action?: string;
  appId?: string;
  adminId?: string;
  page: number;
  pageSize: number;
}

export async function listAuditLogs(filters: AuditFilters): Promise<{
  logs: AuditLogDto[];
  total: number;
  pageCount: number;
}> {
  const where = {
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.appId ? { appId: filters.appId } : {}),
    ...(filters.adminId ? { adminId: filters.adminId } : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: filters.pageSize,
      skip: (filters.page - 1) * filters.pageSize,
      include: {
        admin: { select: { name: true } },
        app: { select: { name: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: rows.map((r) => ({
      id: r.id,
      action: r.action,
      adminName: r.admin?.name ?? null,
      appName: r.app?.name ?? null,
      targetType: r.targetType,
      targetId: r.targetId,
      ip: r.ip,
      createdAt: r.createdAt.toISOString(),
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}
