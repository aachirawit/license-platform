import type { NextRequest } from "next/server";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { ok } from "@/lib/http/response";
import { listAuditLogs } from "@/lib/services/audit-service";
import { getAppOrThrow } from "@/lib/services/app-service";

export const runtime = "nodejs";

const querySchema = z.object({
  action: z.string().max(64).optional(),
  appId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export async function GET(req: NextRequest) {
  try {
    await requirePermission("audit.read");
    const url = new URL(req.url);
    const f = querySchema.parse(Object.fromEntries(url.searchParams));
    const resolvedAppId = f.appId ? (await getAppOrThrow(f.appId)).id : undefined;
    return ok(await listAuditLogs({ ...f, appId: resolvedAppId }));
  } catch (err) {
    return toErrorResponse(err);
  }
}
