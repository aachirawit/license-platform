import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";
import { getLicenseDetail } from "@/lib/services/license-service";

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
