# License Platform

A multi-app license management dashboard. One panel issues and manages license
keys for many products (SZK Optimizer, Game Booster, Mouse Optimizer, FiveM
Optimizer, …), each scoped to its own app, packages, licenses, analytics, and
audit trail.

It is built around a provider abstraction: the default **MockLicenseProvider**
is a complete Postgres-backed backend that works with no third-party account,
and a **KeyAuthProvider** stub is ready to be filled in later without touching
the dashboard. See [docs/PROVIDERS.md](docs/PROVIDERS.md).

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **Prisma** + **PostgreSQL** (built for Neon; any Postgres works)
- **Tailwind** + **shadcn/ui** (Radix) + **lucide-react** + **Recharts**
- **Zod** validation, **react-hook-form**
- **argon2id** password hashing, **HMAC-SHA256** for keys/HWIDs
- Session auth with HTTP-only cookies — no JWT in the browser, no localStorage
- Deploys to **Vercel**. No Docker, Redis, or microservices.

## Quick start

```bash
# 1. Install
npm install

# 2. Configure — copy the example and fill in the values
cp .env.example .env.local
#   Generate each secret with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"

# 3. Create the schema and seed demo data (3 apps, packages, an admin, licenses)
npm run prisma:migrate
npm run seed

# 4. Run
npm run dev            # http://localhost:3000
```

The seed prints the dev admin credentials (default `admin@example.com` /
`ChangeMe!123`, overridable via `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
**Change the password after first login.**

## Scripts

| Script                    | Does                                             |
| ------------------------- | ------------------------------------------------ |
| `npm run dev`             | Dev server                                       |
| `npm run build`           | `prisma generate` + production build             |
| `npm start`               | Serve the production build                       |
| `npm run typecheck`       | `tsc --noEmit`                                    |
| `npm run prisma:migrate`  | Create/apply a dev migration                     |
| `npm run prisma:deploy`   | Apply migrations in production                    |
| `npm run seed`            | Seed demo data                                   |

## Architecture

```
app/
  (auth)/login              public sign-in
  (dashboard)/              auth-guarded: dashboard, apps, licenses, analytics,
                            security, audit-logs, admins, settings
  api/                      route handlers (envelope: { success, code, data })
    activate                PUBLIC key activation for desktop clients
lib/
  license/                  LicenseProvider interface, mock + keyauth, factory
  auth/                     session, cookies, RBAC, requirePermission
  security/                 crypto (keys/HWID/session), argon2 passwords
  services/                 app/package/license/admin/analytics/audit/security
  http/                     response envelope, errors, rate-limit, request
  discord/                  server-only masked webhook alerts
docs/                       PROVIDERS, DEPLOYMENT, SECURITY, API
```

**Key ideas**

- **One provider seam.** `getLicenseProvider(app)` is the only place that maps a
  provider kind to a class; routes, services, and UI use the interface.
- **Server-authoritative RBAC.** Every sensitive route calls
  `requirePermission(...)` with the admin loaded from the session cookie. The
  client is never trusted for role, app ownership, or license status.
- **Secrets never reach the browser.** Keys and HWIDs are stored only as HMAC
  hashes; the Discord webhook, seller secrets, and HMAC keys live in server env.
- **Derived expiry.** A license past its expiry reads `EXPIRED` everywhere,
  regardless of the stored status column, so a lapsed key can never activate.
- **Everything sensitive is audited**, with security events + optional Discord
  alerts for the high-signal ones.

## Documentation

- [docs/PROVIDERS.md](docs/PROVIDERS.md) — the provider abstraction and the
  KeyAuth migration path
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — Vercel + Neon deployment
- [docs/SECURITY.md](docs/SECURITY.md) — security model and a go-live checklist
- [docs/API.md](docs/API.md) — API reference with request/response examples

## License providers today

KeyAuth is **not** required. The platform ships fully working on the mock
provider. When a KeyAuth account exists, implement the adapter one method at a
time against the current official docs — the stub fails safe until then, so no
app breaks in the meantime.
