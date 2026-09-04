import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { createApp, listApps } from "@/lib/services/app-service";
import { writeAudit } from "@/lib/services/audit-service";
import { createAppSchema } from "@/lib/validation/app";

export const runtime = "nodejs";

// GET /api/apps — every role that can see the dashboard can list apps.
export async function GET() {
  try {
    await requirePermission("app.read");
    const apps = await listApps();
    return ok({ apps });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/apps — create an application.
export async function POST(req: NextRequest) {
  try {
    const admin = await requirePermission("app.write");
    rateLimit(RULES.mutation, admin.id);

    const body = await req.json().catch(() => null);
    const input = createAppSchema.parse(body);
    const app = await createApp(input);

    await writeAudit({
      adminId: admin.id,
      action: "APP_CREATED",
      appId: app.id,
      targetType: "App",
      targetId: app.id,
      metadata: { name: app.name, appId: app.appId, provider: app.provider },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ app }, "APP_CREATED", 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
