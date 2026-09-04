import { prisma } from "@/lib/db/prisma";

// Aggregates for the dashboard and analytics pages. Status counts mirror the
// mock provider's DERIVED expiry rule: a key past its expiry counts as expired
// even if its column still says ACTIVE/UNUSED, so the numbers match what the
// licence list shows.

export interface OverviewCounts {
  apps: number;
  licenses: number;
  active: number;
  unused: number;
  expired: number;
  banned: number;
  revoked: number;
}

/** Build the where-fragments for each derived status, optionally app-scoped. */
function statusWhere(now: Date, appId?: string) {
  const base = appId ? { appId } : {};
  return {
    active: { ...base, status: "ACTIVE" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    unused: { ...base, status: "UNUSED" as const, OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
    expired: { ...base, status: { in: ["ACTIVE", "UNUSED"] as ("ACTIVE" | "UNUSED")[] }, expiresAt: { not: null, lte: now } },
    banned: { ...base, status: "BANNED" as const },
    revoked: { ...base, status: "REVOKED" as const },
  };
}

export async function getOverview(appId?: string): Promise<OverviewCounts> {
  const now = new Date();
  const w = statusWhere(now, appId);
  const base = appId ? { appId } : {};

  const [apps, licenses, active, unused, expired, banned, revoked] = await Promise.all([
    appId ? Promise.resolve(1) : prisma.app.count(),
    prisma.license.count({ where: base }),
    prisma.license.count({ where: w.active }),
    prisma.license.count({ where: w.unused }),
    prisma.license.count({ where: w.expired }),
    prisma.license.count({ where: w.banned }),
    prisma.license.count({ where: w.revoked }),
  ]);

  return { apps, licenses, active, unused, expired, banned, revoked };
}

export interface StatusSlice {
  status: string;
  count: number;
}

export async function getStatusDistribution(appId?: string): Promise<StatusSlice[]> {
  const c = await getOverview(appId);
  return [
    { status: "Active", count: c.active },
    { status: "Unused", count: c.unused },
    { status: "Expired", count: c.expired },
    { status: "Banned", count: c.banned },
    { status: "Revoked", count: c.revoked },
  ].filter((s) => s.count > 0);
}

export interface DayPoint {
  date: string; // YYYY-MM-DD
  generated: number;
  activated: number;
}

/**
 * Daily generated vs. activated counts over the last `days`. Uses Postgres
 * date_trunc so bucketing happens in the database; the gaps (days with zero
 * events) are filled in JS so the chart has a continuous x-axis.
 */
export async function getActivitySeries(days: number, appId?: string): Promise<DayPoint[]> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setHours(0, 0, 0, 0);

  const appFilter = appId ? prismaSql`AND "appId" = ${appId}` : prismaSql``;

  const generated = await prisma.$queryRaw<{ d: Date; n: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS d, count(*)::bigint AS n
    FROM "License"
    WHERE "createdAt" >= ${since} ${appFilter}
    GROUP BY 1 ORDER BY 1`;

  const activated = await prisma.$queryRaw<{ d: Date; n: bigint }[]>`
    SELECT date_trunc('day', "activatedAt") AS d, count(*)::bigint AS n
    FROM "License"
    WHERE "activatedAt" IS NOT NULL AND "activatedAt" >= ${since} ${appFilter}
    GROUP BY 1 ORDER BY 1`;

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const gen = new Map(generated.map((r) => [key(r.d), Number(r.n)]));
  const act = new Map(activated.map((r) => [key(r.d), Number(r.n)]));

  const out: DayPoint[] = [];
  for (let i = 0; i < days; i++) {
    const day = new Date(since.getTime() + i * 86_400_000);
    const k = key(day);
    out.push({ date: k, generated: gen.get(k) ?? 0, activated: act.get(k) ?? 0 });
  }
  return out;
}

export interface RecentEntry {
  id: string;
  action: string;
  by: string | null;
  appName: string | null;
  at: string;
}

export async function getRecentActivity(limit = 8, appId?: string): Promise<RecentEntry[]> {
  const rows = await prisma.auditLog.findMany({
    where: appId ? { appId } : {},
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { admin: { select: { name: true } }, app: { select: { name: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    by: r.admin?.name ?? null,
    appName: r.app?.name ?? null,
    at: r.createdAt.toISOString(),
  }));
}

// Prisma.sql helper imported lazily to keep this module's top clean.
import { Prisma } from "@prisma/client";
function prismaSql(strings: TemplateStringsArray, ...values: unknown[]) {
  return Prisma.sql(strings, ...values);
}
