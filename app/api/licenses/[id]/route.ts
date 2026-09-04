import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { getLicenseDetail, renameLicense } from "@/lib/services/license-service";
import { renameLicenseSchema } from "@/lib/validation/license";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

// GET /api/licenses/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission("license.read");
    const { id } = await params;
    return ok(await getLicenseDetail(id));
  } catch (err) {
    return toErrorResponse(err);
  }
}

// PATCH /api/licenses/[id] — set/clear the admin label. Support-level action
// (same permission as HWID reset), so READ_ONLY cannot rename.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.reset_hwid");
    await rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const body = await req.json().catch(() => null);
    const { name } = renameLicenseSchema.parse(body);
    const license = await renameLicense(id, name, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ license }, "LICENSE_RENAMED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
