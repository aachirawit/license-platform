# Deployment (Vercel + Neon)

The platform is designed for Vercel serverless functions with a Neon Postgres
database. No Docker, Redis, or long-running server is required.

## 1. Database (Neon)

1. Create a project at [neon.tech](https://neon.tech).
2. Copy two connection strings from the dashboard:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`. The app uses this at
     runtime; pooling is what keeps serverless connection counts sane.
   - **Direct** (host without `-pooler`) → `DIRECT_URL`. Prisma Migrate uses
     this; migrations must run over a direct connection, not the pooler.
3. Both should end with `?sslmode=require`.

## 2. Secrets

Generate three independent secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

- `AUTH_SECRET` — signs/derives session material.
- `LICENSE_HMAC_SECRET` — hashes license keys. **Set once and never rotate**
  casually: rotating it invalidates every stored key hash.
- `HWID_HMAC_SECRET` — hashes HWIDs; same rule.

Treat all three like production database passwords. They exist only in the
deployment environment, never in git.

## 3. Vercel environment variables

In the Vercel project settings, add (Production + Preview):

| Variable                      | Value                                       |
| ----------------------------- | ------------------------------------------- |
| `DATABASE_URL`                | Neon **pooled** URL                         |
| `DIRECT_URL`                  | Neon **direct** URL                         |
| `AUTH_SECRET`                 | generated secret                            |
| `LICENSE_HMAC_SECRET`         | generated secret                            |
| `HWID_HMAC_SECRET`            | generated secret                            |
| `APP_URL`                     | `https://your-domain` (drives secure cookies) |
| `LICENSE_PROVIDER`            | `MOCK` (default for new apps)               |
| `DISCORD_WEBHOOK_URL`         | optional; server-only alerts                |
| `TELEMETRY_RETENTION_DAYS`    | optional (default 90)                       |
| `SECURITY_EVENT_RETENTION_DAYS` | optional (default 180)                    |
| `AUDIT_LOG_RETENTION_DAYS`    | optional (default 365)                      |

`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are only needed if you seed in a
non-interactive environment; prefer creating the first admin via seed once, then
managing admins from the dashboard.

## 4. Migrations

`npm run build` runs `prisma generate` but **not** `migrate` — schema changes
are applied explicitly so a deploy never silently alters the database.

Apply migrations against production using the direct URL:

```bash
# with production DATABASE_URL/DIRECT_URL in the environment
npm run prisma:deploy
```

Run this before (or as a release step for) the deploy that needs the new schema.

## 5. First deploy

1. Push the repo and import it into Vercel (framework auto-detected as Next.js).
2. Set the environment variables above.
3. Deploy. Vercel runs `npm run build`.
4. Run `npm run prisma:deploy` once against the production database.
5. Seed the first admin **once** (locally, pointed at the production DB, or via a
   one-off script), then sign in and change the password immediately.

## 6. Security headers

Security response headers (CSP, HSTS, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, COOP) are set in `next.config.ts` and apply on Vercel
automatically. HSTS only takes effect over HTTPS, which Vercel provides. No
extra edge config is required. See [SECURITY.md](SECURITY.md).

## 7. Rate limiting note

The in-process rate limiter is per serverless instance, which is a deliberate
choice for a no-Redis deployment: it blunts brute force and spam without extra
infrastructure. For login, the authoritative control is the database-backed
failed-attempt lock. If you later need a globally exact limit across instances,
swap `lib/http/rate-limit.ts` for an Upstash/Redis store behind the same
`rateLimit(rule, id)` signature — no call sites change.
