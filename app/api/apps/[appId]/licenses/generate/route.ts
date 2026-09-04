import type { NextRequest } from "next/server";

import { requirePermission } from "@/lib/auth/context";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { generateLicenses } from "@/lib/services/license-service";
import { generateLicensesSchema } from "@/lib/validation/license";

export const runtime = "nodejs";

type Params = { params: Promise<{ appId: string }> };

// POST /api/apps/[appId]/licenses/generate
// Returns the plaintext keys ONCE. They are not persisted in the clear and
// cannot be retrieved again after this response.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const admin = await requirePermission("license.generate");
    rateLimit(RULES.generate, admin.id);

    const { appId } = await params;
    const body = await req.json().catch(() => null);
    const input = generateLicensesSchema.parse(body);

    const generated = await generateLicenses(appId, input, {
      adminId: admin.id,
      ip: clientIp(req),
      userAgent: userAgent(req),
    });

    return ok(
      {
        count: generated.length,
        // The full keys, shown once in the result dialog.
        keys: generated.map((g) => g.plaintextKey),
        licenses: generated.map((g) => g.license),
      },
      "LICENSES_GENERATED",
      201,
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
