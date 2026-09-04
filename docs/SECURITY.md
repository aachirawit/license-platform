# Security model

This document describes what the platform does to protect keys, sessions, and
admin actions, and a checklist to run before going live. The guiding assumption:
**the desktop client can be reverse engineered, and the browser is untrusted.**

## Secrets and hashing

- **License keys** are generated with a CSPRNG over an unambiguous alphabet
  (no `0/O/1/I`) using rejection sampling. Only an **HMAC-SHA256** hash
  (`keyHash`) and a short display `keyPrefix` are stored. The plaintext key is
  returned **once** at generation and never again.
- **HWIDs** are stored only as **HMAC-SHA256** (`hwidHash`). A mismatch tells the
  client only that it mismatched — never the bound value.
- **Passwords** use **argon2id** (memory-hard). Hashes are never logged or
  returned.
- **Sessions** use an opaque random token in the cookie; only its hash is stored
  server-side, so a database read cannot reconstruct a live session token.
- The HMAC keys (`LICENSE_HMAC_SECRET`, `HWID_HMAC_SECRET`) and `AUTH_SECRET`
  live only in server environment variables.

## Authentication and sessions

- Session token is delivered in an **HTTP-only, Secure, SameSite=Lax** cookie —
  not readable by JavaScript, not stored in localStorage.
- Every request **re-validates** the session against the database, so disabling
  an admin or changing their role/password **signs them out instantly** (all
  their sessions are revoked).
- Login has a **database-backed failed-attempt lock** plus a per-IP rate limit.

## Authorization (RBAC)

- Roles: `SUPER_ADMIN`, `ADMIN`, `SUPPORT`, `READ_ONLY`.
- The permission matrix lives in `lib/auth/rbac.ts` as data. Every sensitive
  route calls `requirePermission(...)` with the admin loaded from the session —
  **the client is never trusted** to state its role, app ownership, license
  status, or provider identity.
- The last active `SUPER_ADMIN` cannot be demoted or disabled, so the platform
  can never be locked out of its own admin controls.
- Deleting an app (cascades licenses) is `SUPER_ADMIN`-only.

## Multi-app isolation

- Every license, package, analytic, and audit entry is scoped to an app.
- The public activation endpoint resolves an app by its public `appId` and
  returns a **generic** `INVALID_LICENSE` for an unknown app or a key belonging
  to a different app, so it cannot be used to enumerate apps or keys.

## Derived expiry

A license past its `expiresAt` reads `EXPIRED` in the list, the analytics
counts, and the activation check alike — regardless of the stored status column.
A lapsed key cannot activate even if a status update lagged.

## Auditing and alerting

- Every sensitive admin action writes an append-only **audit log** entry
  (actor, action, target, IP, user-agent). Passwords are never logged — only
  *that* a password was reset.
- Notable events (login failures, HWID mismatches, activation attempts on
  banned/expired keys) are recorded as **security events**.
- High-signal events optionally fan out to **Discord**. The webhook URL is
  server-only and the message is masked: no full key, no full HWID, no token,
  masked IP only. A webhook failure is swallowed and never breaks a request.

## Transport and headers

Set in `next.config.ts`, applied to every route:

- **Content-Security-Policy** — `default-src 'self'`; scripts limited to same
  origin (`'unsafe-inline'` retained for Next's hydration bootstrap;
  `'unsafe-eval'` only in dev); `object-src 'none'`; `base-uri 'self'`;
  `form-action 'self'`; `frame-ancestors 'none'`.
- **HSTS** (2 years, subdomains, preload), **X-Content-Type-Options: nosniff**,
  **X-Frame-Options: DENY**, **Referrer-Policy: strict-origin-when-cross-origin**,
  **Permissions-Policy** denying camera/mic/geolocation, **COOP: same-origin**.
- `X-Powered-By` is disabled.

> Note on CSP: a per-request nonce with `'strict-dynamic'` is stronger but
> requires every page to be dynamically rendered, which cannot work with
> statically prerendered pages (`/login`, the 404). We chose a prerender-safe
> static policy; the remaining directives close framing, plugin content,
> base-tag, and form-hijack vectors, and React escapes rendered output.

## Error handling

Errors return the envelope `{ success: false, code, message }` with a safe code.
Stack traces and internal detail are never sent to the client; an unexpected
error becomes `INTERNAL_ERROR` and the detail is logged server-side with a
digest reference.

## Go-live checklist

- [ ] All three secrets (`AUTH_SECRET`, `LICENSE_HMAC_SECRET`, `HWID_HMAC_SECRET`)
      are freshly generated, unique, and set only in the deployment environment.
- [ ] `HWID_HMAC_SECRET` and `LICENSE_HMAC_SECRET` are final — rotating them
      later invalidates stored hashes.
- [ ] `DATABASE_URL` is the **pooled** Neon URL; `DIRECT_URL` is the direct one.
- [ ] `APP_URL` is the real HTTPS origin (drives Secure cookies).
- [ ] Migrations applied with `npm run prisma:deploy`.
- [ ] The seeded dev admin password has been changed; no default credentials
      remain.
- [ ] `.env` / `.env.local` are gitignored and no secret is committed.
- [ ] `DISCORD_WEBHOOK_URL` (if used) is set server-side only.
- [ ] Security headers verified on the deployed origin (`curl -I https://…`).
- [ ] Public `/api/activate` tested end to end from a client, including the
      refusal codes.
