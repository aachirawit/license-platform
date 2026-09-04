import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { updateAdmin } from "@/lib/services/admin-service";
import { writeAudit } from "@/lib/services/audit-service";
import { updateAdminSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("admin.write");
    await rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const input = updateAdminSchema.parse(body);
    const updated = await updateAdmin(id, input);

    await writeAudit({
      adminId: admin.id,
      action: "ADMIN_UPDATED",
      targetType: "Admin",
      targetId: id,
      // Never log the password; only which fields changed.
      metadata: {
        role: input.role,
        disabled: input.disabled,
        passwordReset: Boolean(input.password),
      },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ admin: updated }, "ADMIN_UPDATED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
