import type { NextRequest } from "next/server";

import { setSessionCookie } from "@/lib/auth/cookies";
import { toErrorResponse } from "@/lib/http/errors";
import { clientIp, userAgent } from "@/lib/http/request";
import { rateLimit, RULES } from "@/lib/http/rate-limit";
import { ok } from "@/lib/http/response";
import { login } from "@/lib/services/auth-service";
import { loginSchema } from "@/lib/validation/auth";

// This route runs on Node (argon2 + Prisma), not the edge.
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const ip = clientIp(req);
    // Volume guard keyed by IP, before touching argon2.
    await rateLimit(RULES.login, ip ?? "unknown");

    const body = await req.json().catch(() => null);
    const { email, password } = loginSchema.parse(body);

    const result = await login(email, password, { ip, userAgent: userAgent(req) });
    await setSessionCookie(result.session.token, result.session.expiresAt);

    return ok(
      {
        admin: result.admin,
        expiresAt: result.session.expiresAt.toISOString(),
      },
      "LOGIN_SUCCESS",
    );
  } catch (err) {
    return toErrorResponse(err);
  }
}
