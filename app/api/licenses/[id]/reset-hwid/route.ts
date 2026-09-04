import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { resetHwid } from "@/lib/services/license-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.reset_hwid");
    rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const license = await resetHwid(id, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ license }, "HWID_RESET");
  } catch (err) {
    return toErrorResponse(err);
  }
}
