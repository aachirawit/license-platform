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

// The dynamic segment is named [appId] to match the nested licence/package
// routes under the same path - Next requires one consistent slug name per path
// position. It still accepts an app id or slug (app-service resolves either).
type Params = { params: Promise<{ appId: string }> };

// GET /api/apps/[appId]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission("app.read");
    const { appId } = await params;
    return ok({ app: await getApp(appId) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/apps/[appId]
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("app.write");
    await rateLimit(RULES.mutation, admin.id);

    const { appId } = await params;
    const body = await req.json().catch(() => null);
    const input = updateAppSchema.parse(body);
    const app = await updateApp(appId, input);

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

// DELETE /api/apps/[appId] — destructive (cascades licences), SUPER_ADMIN only.
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("app.write");
    if (!isAtLeast(admin.role, "SUPER_ADMIN")) {
      throw Errors.forbidden("Only a super admin can delete an application");
    }
    await rateLimit(RULES.mutation, admin.id);

    const { appId } = await params;
    const result = await deleteApp(appId);

    await writeAudit({
      adminId: admin.id,
      action: "APP_DELETED",
      targetType: "App",
      targetId: appId,
      metadata: { removedLicenses: result.removedLicenses },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok(result, "APP_DELETED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
