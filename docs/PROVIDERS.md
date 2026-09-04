# License providers

The platform never talks to a licensing backend directly. Every route, service,
and component goes through one interface — `LicenseProvider` — and a factory
picks the concrete implementation per app. That is what lets a single dashboard
manage many apps, some on the built-in mock backend and some (later) on KeyAuth,
without any handler knowing which is which.

```
UI / API route
      │  (never branches on provider)
      ▼
lib/services/*          ← app scoping, audit, security events, Discord
      │
      ▼
getLicenseProvider(app) ← lib/license/factory.ts  (the ONLY switch on kind)
      │
      ├── MOCK    → MockLicenseProvider   (persists to Postgres via Prisma)
      └── KEYAUTH → KeyAuthProvider       (stub; fails safe until implemented)
```

## The interface

`lib/license/provider.ts` defines the contract. Every provider implements the
same methods and returns the same shapes (`lib/license/types.ts`):

| Method             | Purpose                                             |
| ------------------ | --------------------------------------------------- |
| `generateLicenses` | Mint N keys; returns plaintext **once**             |
| `getLicense`       | One license by id                                   |
| `getLicenses`      | Paginated + filtered list for an app                |
| `banLicense`       | Block a key from activating                         |
| `unbanLicense`     | Reverse a ban                                       |
| `resetHwid`        | Clear the bound hardware id so it can re-bind       |
| `revokeLicense`    | Permanently kill a key                              |
| `extendLicense`    | Add days to expiry                                  |
| `activate`         | Client-facing verify + HWID bind                    |

The **services layer** (`lib/services/license-service.ts`) wraps every call with
the concerns a provider does not own: app scoping, the audit trail, security
events, and Discord notices. Providers stay narrow — they only know how to talk
to their backend.

## What the platform owns vs. what the provider owns

Regardless of provider, these are platform rules and are enforced in our code,
never delegated to the backend:

- **Keys are never stored in plaintext.** Only an HMAC-SHA256 hash (`keyHash`)
  and a short `keyPrefix` for display. The plaintext is returned once at
  generation and never again.
- **HWIDs are never stored in plaintext.** Only `hwidHash` (HMAC-SHA256).
- **Expiry status is derived.** A row past its `expiresAt` reads `EXPIRED`
  regardless of the stored status column, so a lapsed key can never activate
  even if a backend is slow to update.
- **Every sensitive action is audited** and, where relevant, raises a security
  event and an optional masked Discord alert.

The provider owns only the backend-specific mechanics of the methods above.

## MockLicenseProvider (default, fully functional)

`lib/license/mock-provider.ts` is a complete, production-usable implementation
backed by Postgres. It is **not** a fake — it is the real default backend:

- Keys are generated with a CSPRNG (`lib/security/crypto.ts`), rejection-sampled
  over an unambiguous alphabet (no `0/O/1/I`).
- `activate` binds the HWID on first use, returns a generic `INVALID_LICENSE`
  for unknown or cross-app keys (no oracle), and never reveals the bound HWID on
  a mismatch.
- All state lives in the `License` table, so the dashboard, analytics, and the
  activation endpoint are always consistent.

An app on `MOCK` needs no external account and no extra secrets beyond the HMAC
keys already required to run.

## KeyAuthProvider (future, intentionally a stub)

`lib/license/keyauth-provider.ts` implements the same interface but every method
throws `ProviderUnavailableError`. This is deliberate:

> Inventing KeyAuth endpoints that have not been verified against the current
> official docs would compile, look finished, and fail in production. A stub
> that fails safely is strictly better than plausible-looking wrong code.

The factory only ever returns this provider for an app explicitly set to
`KEYAUTH`; `MOCK` apps are unaffected. So the stub can sit in the tree
indefinitely without risk.

### Migrating an app to KeyAuth (when an account exists)

You do **not** touch the dashboard, API routes, or services — only the adapter
and one config field. Against the **current** official KeyAuth Seller/API docs:

1. **Config, not secrets, on the app.** Put non-secret KeyAuth identifiers
   (`name`, `ownerid`, `version`) in `App.providerConfig`. Read the **seller
   key** from a server-side env var only — never from the browser, never stored
   in a `License` row.
2. **Implement the constructor** to read that config + env into a typed shape.
3. **Fill in each method** against the matching KeyAuth seller operation:
   - `generateLicenses` → "add license" seller call; map returned keys into
     `GeneratedLicense`, hashing/masking on our side exactly as the mock does.
   - `getLicense` / `getLicenses` → license listing; cache metadata into our
     `License` table keyed by a `providerLicenseId` so the dashboard stays fast
     while KeyAuth remains authoritative.
   - `ban` / `unban` / `reset` / `revoke` / `extend` → the matching seller ops.
   - `activate` → the client license-verify flow (the SZK C++ client already
     speaks this; see that repo's `keyauth.cpp` for the request shape).
4. **Keep the platform invariants.** Even with KeyAuth authoritative, still store
   only hashes locally, still derive expiry, still audit. The backend changes;
   the platform's guarantees do not.
5. **Switch the app** to `KEYAUTH` (via `providerConfig` + the provider field).
   Leave other apps on `MOCK`. Roll back by flipping the field back.

Implement and verify one method at a time. Until a method is proven against the
live API, leave it throwing — a half-migrated app should refuse rather than
silently corrupt license state.

## Adding a third provider

1. Implement `LicenseProvider` in a new file under `lib/license/`.
2. Add its kind to the `LicenseProviderKind` enum in `prisma/schema.prisma` and
   migrate.
3. Add one `case` to `getLicenseProvider` in `lib/license/factory.ts`.

The exhaustiveness guard in the factory's `default` branch will fail the type
check until the new kind is wired in, so you cannot forget step 3.
