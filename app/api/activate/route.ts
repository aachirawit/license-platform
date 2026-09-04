import type { NextRequest } from "next/server";

import { clientIp } from "@/lib/http/request";
import { toErrorResponse } from "@/lib/http/errors";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { activateLicense } from "@/lib/services/license-service";
import { signActivationBody } from "@/lib/security/activation-signing";
import { activateSchema } from "@/lib/validation/license";

export const runtime = "nodejs";

// Serialise + (optionally) Ed25519-sign the reply. We build the body string
// ourselves rather than using NextResponse.json so the exact bytes we sign are
// the exact bytes that go on the wire - the client verifies the signature over
// (timestamp + body), so any re-serialisation would break it.
function respond(payload: object, status: number): Response {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const sig = signActivationBody(body);
  if (sig) Object.assign(headers, sig);
  return new Response(body, { status, headers });
}

// POST /api/activate — PUBLIC, unauthenticated key activation for desktop
// clients. No session, no admin. Rate-limited per IP to blunt brute force.
//
// Response contract (the client checks both HTTP status and body.code):
//   200  { success: true,  code: "LICENSE_VALID", data: { ... } }
//   403  { success: false, code: <refusal code>, message }
//   429  { success: false, code: "RATE_LIMITED", message }
//   400  { success: false, code: "VALIDATION_ERROR", message }
//
// Refusal codes mirror the provider: INVALID_LICENSE, LICENSE_EXPIRED,
// LICENSE_BANNED, LICENSE_REVOKED, HWID_MISMATCH. None reveal the bound HWID or
// whether a given app or key exists beyond the generic INVALID_LICENSE.
const REFUSAL_MESSAGE: Record<string, string> = {
  INVALID_LICENSE: "License key is not valid for this application.",
  LICENSE_EXPIRED: "This license has expired.",
  LICENSE_BANNED: "This license has been banned.",
  LICENSE_REVOKED: "This license has been revoked.",
  HWID_MISMATCH: "This license is bound to a different machine.",
};

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    rateLimit(RULES.activate, ip ?? "unknown");

    const body = await req.json().catch(() => null);
    const input = activateSchema.parse(body);

    const result = await activateLicense(input, ip);
    if (!result.ok) {
      return respond(
        {
          success: false,
          code: result.code,
          message: REFUSAL_MESSAGE[result.code] ?? "Activation refused.",
        },
        403,
      );
    }

    return respond(
      {
        success: true,
        code: "LICENSE_VALID",
        data: {
          valid: true,
          status: result.license.status,
          expiresAt: result.license.expiresAt,
          activatedAt: result.license.activatedAt,
        },
      },
      200,
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
