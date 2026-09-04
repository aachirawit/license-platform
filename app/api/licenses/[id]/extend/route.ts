import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { extendLicense } from "@/lib/services/license-service";
import { extendLicenseSchema } from "@/lib/validation/license";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.extend");
    rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const { days } = extendLicenseSchema.parse(body);
    const license = await extendLicense(id, days, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ license }, "LICENSE_EXTENDED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
