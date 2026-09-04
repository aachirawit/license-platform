import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/auth/context";
import { Errors, toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { deletePackage, updatePackage } from "@/lib/services/package-service";
import { writeAudit } from "@/lib/services/audit-service";
import { updatePackageSchema } from "@/lib/validation/package";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// A package id alone does not carry its app, so resolve the owning appId first
// and pass it to the service, which enforces the ownership check.
async function ownerAppId(packageId: string): Promise<string> {
  const pkg = await prisma.licensePackage.findUnique({
    where: { id: packageId },
    select: { appId: true },
  });
  if (!pkg) throw Errors.notFound("PACKAGE_NOT_FOUND", "Package not found");
  return pkg.appId;
}

// PATCH /api/packages/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("package.write");
    rateLimit(RULES.mutation, admin.id);

    const { id } = await params;
    const appId = await ownerAppId(id);
    const body = await req.json().catch(() => null);
    const input = updatePackageSchema.parse(body);
    const pkg = await updatePackage(appId, id, input);

    await writeAudit({
      adminId: admin.id,
      action: "PACKAGE_UPDATED",
      appId,
      targetType: "LicensePackage",
      targetId: id,
      metadata: input as Record<string, unknown>,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ package: pkg }, "PACKAGE_UPDATED");
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/packages/[id] — issued licences are kept (packageId set null).
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("package.write");
    rateLimit(RULES.mutation, admin.id);

    const { id } = await params;
    const appId = await ownerAppId(id);
    await deletePackage(appId, id);

    await writeAudit({
      adminId: admin.id,
      action: "PACKAGE_DELETED",
      appId,
      targetType: "LicensePackage",
      targetId: id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ deleted: true }, "PACKAGE_DELETED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
