import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { revealLicenseKey } from "@/lib/services/license-service";

export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

// POST /api/licenses/[id]/reveal — decrypt and return the full key for copy.
// Support-level (same permission as HWID reset) and audited, since it exposes a
// secret. Not a GET: revealing is an action with a side effect (the audit +
// security-event record), and must not be cached or prefetched.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.reset_hwid");
    await rateLimit(RULES.mutation, admin.id);
    const { id } = await params;
    const key = await revealLicenseKey(id, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });
    return ok({ key }, "LICENSE_KEY_REVEALED");
  } catch (err) {
    return toErrorResponse(err);
  }
}
