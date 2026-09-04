import type { NextRequest } from "next/server";

import { clearSessionCookie, readSessionCookie } from "@/lib/auth/cookies";
import { getCurrentAdmin } from "@/lib/auth/context";
import { revokeSession } from "@/lib/auth/session";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { ok } from "@/lib/http/response";
import { writeAudit } from "@/lib/services/audit-service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const admin = await getCurrentAdmin();
    const token = await readSessionCookie();

    // Revoke server-side (instant, even if the cookie lingers) then clear it.
    await revokeSession(token);
    await clearSessionCookie();

    if (admin) {
      await writeAudit({
        adminId: admin.id,
        action: "ADMIN_LOGOUT",
        ip: clientIp(req),
        userAgent: userAgent(req),
      });
    }

    return ok({ loggedOut: true }, "LOGOUT_SUCCESS");
  } catch (err) {
    return toErrorResponse(err);
  }
}
