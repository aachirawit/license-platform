import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { revokeLicense } from "@/lib/services/license-service";
import { revokeLicenseSchema } from "@/lib/validation/license";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.ban");
    await rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { reason } = revokeLicenseSchema.parse(body ?? {});
    const license = await revokeLicense(id, reason, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ license }, "LICENSE_REVOKED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
