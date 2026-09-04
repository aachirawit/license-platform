import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";
import { listLicenses } from "@/lib/services/license-service";
import { licenseFiltersSchema } from "@/lib/validation/license";

export const runtime = "nodejs";

type Params = { params: Promise<{ appId: string }> };

// GET /api/apps/[appId]/licenses?status=&packageId=&search=&page=&pageSize=
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requirePermission("license.read");
    const { appId } = await params;

    const url = new URL(req.url);
    const filters = licenseFiltersSchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      packageId: url.searchParams.get("packageId") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    return ok(await listLicenses(appId, filters));
  } catch (err) {
    return toErrorResponse(err);
  }
}
