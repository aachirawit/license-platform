# API reference

All endpoints share one JSON envelope:

```jsonc
// success
{ "success": true,  "code": "OK", "data": { /* ... */ } }
// error
{ "success": false, "code": "VALIDATION_ERROR", "message": "Human-readable." }
```

Admin endpoints require a valid session cookie (`lp_session`, HTTP-only) and the
relevant permission for the caller's role. The public activation endpoint
requires no auth. Errors never include a stack trace; an unexpected failure is
`INTERNAL_ERROR`.

Common error codes: `VALIDATION_ERROR` (400), `UNAUTHORIZED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `RATE_LIMITED` (429),
`PROVIDER_UNAVAILABLE` (503), `INTERNAL_ERROR` (500).

---

## Authentication

### `POST /api/auth/login`

```jsonc
// request
{ "email": "admin@example.com", "password": "••••••••" }
```

On success sets the `lp_session` cookie and returns:

```jsonc
{ "success": true, "code": "LOGIN_SUCCESS",
  "data": { "admin": { "id": "…", "email": "…", "name": "…", "role": "SUPER_ADMIN" },
            "expiresAt": "2026-09-11T12:00:00.000Z" } }
```

Failure is a generic `UNAUTHORIZED` (the same for unknown email and wrong
password). Too many attempts → `RATE_LIMITED`.

### `POST /api/auth/logout`

Revokes the current session server-side and clears the cookie.

### `GET /api/auth/me`

Returns the current admin, or `UNAUTHORIZED` if the session is missing/revoked.

---

## Apps

| Method   | Path                  | Permission  | Notes                          |
| -------- | --------------------- | ----------- | ------------------------------ |
| `GET`    | `/api/apps`           | `app.read`  | List apps                      |
| `POST`   | `/api/apps`           | `app.write` | Create an app                  |
| `GET`    | `/api/apps/[appId]`   | `app.read`  | One app (id or slug)           |
| `PATCH`  | `/api/apps/[appId]`   | `app.write` | Update                         |
| `DELETE` | `/api/apps/[appId]`   | `app.write` | **SUPER_ADMIN only**; cascades |

## Packages

| Method  | Path                          | Permission      |
| ------- | ----------------------------- | --------------- |
| `GET`   | `/api/apps/[appId]/packages`  | `package.read`  |
| `POST`  | `/api/apps/[appId]/packages`  | `package.write` |
| `PATCH` | `/api/packages/[id]`          | `package.write` |
| `DELETE`| `/api/packages/[id]`          | `package.write` |

## Licenses (admin)

### `GET /api/apps/[appId]/licenses`

Query: `status`, `packageId`, `search`, `page`, `pageSize`. Returns a paginated
list. License keys are never returned in plaintext — only `keyPrefix` and
metadata.

### `POST /api/apps/[appId]/licenses/generate`  · `license.generate`

```jsonc
// request — quantity + optional package + optional duration override (0 = lifetime)
{ "quantity": 5, "packageId": "pkg_…", "durationDays": 30 }
```

```jsonc
// response — plaintext keys returned ONCE
{ "success": true, "code": "LICENSES_GENERATED",
  "data": { "count": 5,
            "keys": ["SZK-ABCD-EFGH-JKLM", "…"],
            "licenses": [ { "id": "…", "keyPrefix": "SZK", "status": "UNUSED", "expiresAt": "…" } ] } }
```

### Single-license actions

| Method | Path                              | Permission           |
| ------ | --------------------------------- | -------------------- |
| `GET`  | `/api/licenses/[id]`              | `license.read`       |
| `POST` | `/api/licenses/[id]/ban`          | `license.ban`        |
| `POST` | `/api/licenses/[id]/unban`        | `license.ban`        |
| `POST` | `/api/licenses/[id]/revoke`       | `license.ban`        |
| `POST` | `/api/licenses/[id]/reset-hwid`   | `license.reset_hwid` |
| `POST` | `/api/licenses/[id]/extend`       | `license.extend`     |

`ban`/`revoke` accept `{ "reason": "…" }`; `extend` accepts `{ "days": 30 }`.

---

## Public activation (desktop clients)

### `POST /api/activate`

Unauthenticated. Rate-limited per IP. This is what a client (e.g. the SZK C++
app) calls to authenticate a key and bind a machine.

```jsonc
// request
{ "appId": "SZKOPT", "key": "SZK-ABCD-EFGH-JKLM", "hwid": "<machine fingerprint>" }
```

```jsonc
// 200 — valid; HWID is bound on first use
{ "success": true, "code": "LICENSE_VALID",
  "data": { "valid": true, "status": "ACTIVE",
            "expiresAt": "2026-10-04T00:00:00.000Z", "activatedAt": "2026-09-04T…" } }
```

```jsonc
// 403 — refused (generic, no oracle)
{ "success": false, "code": "HWID_MISMATCH",
  "message": "This license is bound to a different machine." }
```

Refusal codes: `INVALID_LICENSE`, `LICENSE_EXPIRED`, `LICENSE_BANNED`,
`LICENSE_REVOKED`, `HWID_MISMATCH`. An unknown app or a key from another app
returns `INVALID_LICENSE` — the endpoint reveals nothing about which apps or
keys exist. Too many attempts → `429 RATE_LIMITED`. Malformed body →
`400 VALIDATION_ERROR`.

The bound HWID is never returned. Notable refusals (mismatch, banned/expired
attempts) are recorded as security events and may raise a Discord alert.

**Example**

```bash
curl -X POST https://your-domain/api/activate \
  -H "Content-Type: application/json" \
  -d '{"appId":"SZKOPT","key":"SZK-ABCD-EFGH-JKLM","hwid":"a1b2c3d4"}'
```

---

## Analytics / security / audit / admins

| Method  | Path                    | Permission    |
| ------- | ----------------------- | ------------- |
| `GET`   | `/api/analytics`        | `analytics.read` |
| `GET`   | `/api/security/events`  | `security.read`  |
| `GET`   | `/api/audit-logs`       | `audit.read`     |
| `GET`   | `/api/admins`           | `admin.read`     |
| `POST`  | `/api/admins`           | `admin.write`    |
| `PATCH` | `/api/admins/[id]`      | `admin.write`    |

Changing an admin's role or disabling them revokes their sessions immediately.
The last active `SUPER_ADMIN` cannot be demoted or disabled.
