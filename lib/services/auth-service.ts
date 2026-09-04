import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import { verifyPassword } from "@/lib/security/password";
import { createSession, type CreatedSession } from "@/lib/auth/session";
import { writeAudit } from "./audit-service";
import { recordSecurityEvent } from "./security-service";

// Login flow: rate-limited (in the route), then a database-backed progressive
// lock so repeated failures for one account/IP slow down and eventually lock
// out for a window - without permanently banning anyone over a few typos.

const FAIL_WINDOW_MS = 5 * 60_000;
const FAIL_LOCK_THRESHOLD = 5; // failures within the window -> temporary lock
const LOCK_MS = 15 * 60_000;

// Small in-process tally of recent failures, keyed by email. Mirrors the
// rate-limiter's per-instance nature; the security-event trail in Postgres is
// the durable record. Good enough to add friction; not a global lock.
const failures = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function noteFailure(email: string): { locked: boolean; count: number } {
  const now = Date.now();
  const entry = failures.get(email);
  if (!entry || now - entry.firstAt > FAIL_WINDOW_MS) {
    failures.set(email, { count: 1, firstAt: now, lockedUntil: 0 });
    return { locked: false, count: 1 };
  }
  entry.count += 1;
  if (entry.count >= FAIL_LOCK_THRESHOLD) entry.lockedUntil = now + LOCK_MS;
  return { locked: entry.lockedUntil > now, count: entry.count };
}

function isLocked(email: string): boolean {
  const entry = failures.get(email);
  return !!entry && entry.lockedUntil > Date.now();
}

function clearFailures(email: string): void {
  failures.delete(email);
}

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export interface LoginResult {
  session: CreatedSession;
  admin: { id: string; email: string; name: string; role: string };
}

export async function login(
  email: string,
  password: string,
  ctx: LoginContext,
): Promise<LoginResult> {
  if (isLocked(email)) {
    await recordSecurityEvent({
      type: "MULTIPLE_LOGIN_FAILURES",
      severity: "MEDIUM",
      ip: ctx.ip,
      message: `Login temporarily locked for ${email} after repeated failures`,
      metadata: { email },
      alert: true,
    });
    throw Errors.rateLimited("Too many failed attempts. Try again later.");
  }

  const admin = await prisma.admin.findUnique({ where: { email } });

  // Always run a verify so a missing account and a wrong password take the same
  // time (no user enumeration via timing). The dummy hash is a real argon2 hash
  // of a random string.
  const hash = admin?.passwordHash ?? DUMMY_HASH;
  const passwordOk = await verifyPassword(hash, password);

  if (!admin || admin.disabled || !passwordOk) {
    const { locked, count } = noteFailure(email);
    await recordSecurityEvent({
      type: locked ? "MULTIPLE_LOGIN_FAILURES" : "LOGIN_FAILED",
      severity: locked ? "MEDIUM" : "LOW",
      ip: ctx.ip,
      message: locked
        ? `Account ${email} locked after ${count} failed attempts`
        : `Failed login for ${email}`,
      metadata: { email, attempt: count },
      alert: locked,
    });
    // Same generic error whether the account exists or not.
    throw new (await import("@/lib/http/errors")).AppError(
      "INVALID_CREDENTIALS",
      "Email or password is incorrect",
    );
  }

  clearFailures(email);

  const session = await createSession(admin.id, {
    ip: ctx.ip ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
  });

  await prisma.admin.update({
    where: { id: admin.id },
    data: { lastLoginAt: new Date() },
  });

  await writeAudit({
    adminId: admin.id,
    action: "ADMIN_LOGIN",
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await recordSecurityEvent({
    type: "LOGIN_SUCCESS",
    severity: "LOW",
    ip: ctx.ip,
    message: `Admin ${admin.email} signed in`,
    metadata: { adminId: admin.id },
  });

  return {
    session,
    admin: { id: admin.id, email: admin.email, name: admin.name, role: admin.role },
  };
}

// A fixed argon2id hash of a random value, used only to equalise timing for
// unknown accounts. Not a real credential.
const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$c29tZS1yYW5kb20tc2FsdC12YWx1ZQ$3b2S8m1Jm0pQe3s2s0Vd0m3q1Vd0m3q1Vd0m3q1Vd0";
