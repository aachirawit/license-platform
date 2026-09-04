import type { NextRequest } from "next/server";

import { requirePermission, isAtLeast } from "@/lib/auth/context";
import { Errors, toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { deleteApp, getApp, updateApp } from "@/lib/services/app-service";
import { writeAudit } from "@/lib/services/audit-service";
import { updateAppSchema } from "@/lib/validation/app";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// GET /api/apps/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission("app.read");
    const { id } = await params;
    return ok({ app: await getApp(id) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/apps/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("app.write");
    rateLimit(RULES.mutation, admin.id);

    const { id } = await params;
    const body = await req.json().catch(() => null);
    const input = updateAppSchema.parse(body);
    const app = await updateApp(id, input);

    await writeAudit({
      adminId: admin.id,
      action: "APP_UPDATED",
      appId: app.id,
      targetType: "App",
      targetId: app.id,
      metadata: input as Record<string, unknown>,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ app }, "APP_UPDATED");
  } catch (err) {
    return toErrorResponse(err);
  }
}

// DELETE /api/apps/[id] — destructive (cascades licences), SUPER_ADMIN only.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("app.write");
    if (!isAtLeast(admin.role, "SUPER_ADMIN")) {
      throw Errors.forbidden("Only a super admin can delete an application");
    }
    rateLimit(RULES.mutation, admin.id);

    const { id } = await params;
    const result = await deleteApp(id);

    await writeAudit({
      adminId: admin.id,
      action: "APP_DELETED",
      targetType: "App",
      targetId: id,
      metadata: { removedLicenses: result.removedLicenses },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok(result, "APP_DELETED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
