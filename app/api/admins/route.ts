import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { createAdmin, listAdmins } from "@/lib/services/admin-service";
import { writeAudit } from "@/lib/services/audit-service";
import { createAdminSchema } from "@/lib/validation/admin";

export const runtime = "nodejs";

export async function GET() {
  try {
    await requirePermission("admin.read");
    return ok({ admins: await listAdmins() });
  } catch (err) {
    return toErrorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission("admin.write");
    await rateLimit(RULES.mutation, admin.id);
    const body = await req.json().catch(() => null);
    const input = createAdminSchema.parse(body);
    const created = await createAdmin(input);

    await writeAudit({
      adminId: admin.id,
      action: "ADMIN_CREATED",
      targetType: "Admin",
      targetId: created.id,
      metadata: { email: created.email, role: created.role },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ admin: created }, "ADMIN_CREATED", 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
