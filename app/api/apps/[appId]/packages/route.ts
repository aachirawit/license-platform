import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { getAppOrThrow } from "@/lib/services/app-service";
import { createPackage, listPackages } from "@/lib/services/package-service";
import { writeAudit } from "@/lib/services/audit-service";
import { createPackageSchema } from "@/lib/validation/package";

export const runtime = "nodejs";

type Params = { params: Promise<{ appId: string }> };

// GET /api/apps/[appId]/packages
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await requirePermission("package.read");
    const { appId } = await params;
    // Resolve slug-or-id to the real app id and confirm it exists.
    const app = await getAppOrThrow(appId);
    return ok({ packages: await listPackages(app.id) });
  } catch (err) {
    return toErrorResponse(err);
  }
}

// POST /api/apps/[appId]/packages
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("package.write");
    rateLimit(RULES.mutation, admin.id);

    const { appId } = await params;
    const app = await getAppOrThrow(appId);
    const body = await req.json().catch(() => null);
    const input = createPackageSchema.parse(body);
    const pkg = await createPackage(app.id, input);

    await writeAudit({
      adminId: admin.id,
      action: "PACKAGE_CREATED",
      appId: app.id,
      targetType: "LicensePackage",
      targetId: pkg.id,
      metadata: { name: pkg.name, durationDays: pkg.durationDays },
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok({ package: pkg }, "PACKAGE_CREATED", 201);
  } catch (err) {
    return toErrorResponse(err);
  }
}
