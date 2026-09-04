import type { NextRequest } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";
import {
  getActivitySeries,
  getOverview,
  getRecentActivity,
  getStatusDistribution,
} from "@/lib/services/analytics-service";
import { getAppOrThrow } from "@/lib/services/app-service";

export const runtime = "nodejs";

const querySchema = z.object({
  appId: z.string().optional(),
  days: z.coerce.number().int().min(7).max(365).default(30),
});

// GET /api/analytics?appId=&days=
// appId is optional: omitted = platform-wide, present = scoped to that app
// (resolved id-or-slug, existence checked so a stale scope cannot leak).
export async function GET(req: NextRequest) {
  try {
    await requirePermission("analytics.read");
    const url = new URL(req.url);
    const { appId, days } = querySchema.parse({
      appId: url.searchParams.get("appId") ?? undefined,
      days: url.searchParams.get("days") ?? undefined,
    });

    const resolvedAppId = appId ? (await getAppOrThrow(appId)).id : undefined;

    const [overview, distribution, series, recent] = await Promise.all([
      getOverview(resolvedAppId),
      getStatusDistribution(resolvedAppId),
      getActivitySeries(days, resolvedAppId),
      getRecentActivity(8, resolvedAppId),
    ]);

    return ok({ overview, distribution, series, recent, days });
  } catch (err) {
    return toErrorResponse(err);
  }
}
