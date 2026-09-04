import { prisma } from "@/lib/db/prisma";
import { generateSessionToken, hashSessionToken } from "@/lib/security/crypto";

// Opaque, server-validated sessions. The cookie holds a random token; the
// database stores only its hash, so a database read cannot forge a live cookie.
// Every request re-validates against the row, which is what makes instant
// revocation (logout, ban, admin disable) possible - unlike a self-contained
// JWT that stays valid until it expires.

// 7 days. Long enough to be convenient, short enough to bound a stolen cookie.
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface CreatedSession {
  /** Raw token for the Set-Cookie; never stored server-side. */
  token: string;
  expiresAt: Date;
}

export async function createSession(
  adminId: string,
  meta: { ip?: string; userAgent?: string },
): Promise<CreatedSession> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await prisma.session.create({
    data: {
      adminId,
      tokenHash: hashSessionToken(token),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent?.slice(0, 300) ?? null,
      expiresAt,
    },
  });
  return { token, expiresAt };
}

export interface ValidatedSession {
  sessionId: string;
  admin: {
    id: string;
    email: string;
    name: string;
    role: import("@prisma/client").AdminRole;
  };
}

/**
 * Resolve a raw cookie token to an admin, or null if the session is missing,
 * expired, revoked, or the admin is disabled. A disabled admin is rejected even
 * with a valid cookie, so deactivating an account takes effect immediately.
 */
export async function validateSessionToken(
  token: string | undefined,
): Promise<ValidatedSession | null> {
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { admin: true },
  });

  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;
  if (session.admin.disabled) return null;

  return {
    sessionId: session.id,
    admin: {
      id: session.admin.id,
      email: session.admin.email,
      name: session.admin.name,
      role: session.admin.role,
    },
  };
}

/** Revoke one session (logout). Idempotent. */
export async function revokeSession(token: string | undefined): Promise<void> {
  if (!token) return;
  await prisma.session.updateMany({
    where: { tokenHash: hashSessionToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Revoke every session for an admin (e.g. on password change / forced logout). */
export async function revokeAllSessions(adminId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { adminId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
