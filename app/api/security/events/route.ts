import type { NextRequest } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";
import { listSecurityEvents } from "@/lib/services/security-service";
import { getAppOrThrow } from "@/lib/services/app-service";

export const runtime = "nodejs";

const querySchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  type: z.string().max(64).optional(),
  appId: z.string().optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission("security.read");
    const url = new URL(req.url);
    const f = querySchema.parse(Object.fromEntries(url.searchParams));
    const resolvedAppId = f.appId ? (await getAppOrThrow(f.appId)).id : undefined;
    return ok(await listSecurityEvents({ ...f, appId: resolvedAppId }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
