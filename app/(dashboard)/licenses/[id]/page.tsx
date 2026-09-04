import { notFound } from "next/navigation";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { permissionsFor } from "@/lib/auth/rbac";
import { AppError } from "@/lib/http/errors";
import { getLicenseDetail } from "@/lib/services/license-service";
import { LicenseDetail, type TimelineEntry } from "@/components/licenses/license-detail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function LicenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await requirePermission("license.read");
  const { id } = await params;

  let detail;
  try {
    detail = await getLicenseDetail(id);
  } catch (err) {
    if (err instanceof AppError && err.code === "LICENSE_NOT_FOUND") notFound();
    throw err;
  }

  // Activity timeline: the audit rows targeting this licence, joined with the
  // licence's own generated-at. Admin names are resolved for display.
  const audits = await prisma.auditLog.findMany({
    where: { targetType: "License", targetId: id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { admin: { select: { name: true } } },
  });

  const timeline: TimelineEntry[] = audits.map((a) => ({
    action: a.action,
    at: a.createdAt.toISOString(),
    by: a.admin?.name ?? null,
  }));
  // The generation event may predate per-licence audit rows; ensure it appears.
  timeline.push({ action: "LICENSE_GENERATED", at: detail.license.createdAt, by: null });

  const permissions = permissionsFor(admin.role);
  const perms = {
    ban: permissions.includes("license.ban"),
    extend: permissions.includes("license.extend"),
    resetHwid: permissions.includes("license.reset_hwid"),
  };

  return (
    <div className="p-6">
      <LicenseDetail
        license={detail.license}
        appName={detail.appName}
        appSlug={detail.appSlug}
        packageName={detail.packageName}
        timeline={timeline}
        perms={perms}
      />
    </div>
  );
}
