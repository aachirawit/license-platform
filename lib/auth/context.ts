import type { AdminRole } from "@prisma/client";

import { AppError, Errors } from "@/lib/http/errors";

import { readSessionCookie } from "./cookies";
import { can, type Permission } from "./rbac";
import { validateSessionToken, type ValidatedSession } from "./session";

export type CurrentAdmin = ValidatedSession["admin"] & { sessionId: string };

/**
 * The authenticated admin for the current request, or null. Reads the cookie
 * and re-validates the session against the database every time - there is no
 * trusting a token's own claims.
 */
export async function getCurrentAdmin(): Promise<CurrentAdmin | null> {
  const token = await readSessionCookie();
  const session = await validateSessionToken(token);
  if (!session) return null;
  return { ...session.admin, sessionId: session.sessionId };
}

/** Require any authenticated admin, or throw UNAUTHORIZED. */
export async function requireAdmin(): Promise<CurrentAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw Errors.unauthorized();
  return admin;
}

/**
 * Require an authenticated admin that holds `permission`, or throw. This is the
 * single authorization checkpoint every sensitive route calls; the client's
 * claimed role is never consulted.
 */
export async function requirePermission(permission: Permission): Promise<CurrentAdmin> {
  const admin = await requireAdmin();
  if (!can(admin.role, permission)) {
    throw Errors.forbidden(`Your role (${admin.role}) cannot perform this action`);
  }
  return admin;
}

/** True when the current admin holds the role or higher privilege. */
export function isAtLeast(role: AdminRole, required: AdminRole): boolean {
  const order: AdminRole[] = ["READ_ONLY", "SUPPORT", "ADMIN", "SUPER_ADMIN"];
  return order.indexOf(role) >= order.indexOf(required);
}

export { AppError };
