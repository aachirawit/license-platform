import { cookies } from "next/headers";

// The session cookie. HTTP-only (invisible to JS, so XSS cannot read it),
// Secure in production, SameSite=Lax (sent on top-level navigation but not on
// cross-site POSTs, which blunts CSRF while keeping the login redirect working).

export const SESSION_COOKIE = "lp_session";

function isProd(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function readSessionCookie(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value;
}
