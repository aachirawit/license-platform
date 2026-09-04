import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { unbanLicense } from "@/lib/services/license-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.ban");
    await rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const license = await unbanLicense(id, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ license }, "LICENSE_UNBANNED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
