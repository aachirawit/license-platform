import type { AdminRole } from "@prisma/client";

// Server-side authorization. The client is never trusted to state its own role
// or what it may do - every sensitive route calls requirePermission() with the
// admin loaded from the session cookie.

export type Permission =
  // apps
  | "app.read"
  | "app.write"
  // packages
  | "package.read"
  | "package.write"
  // licences
  | "license.read"
  | "license.generate"
  | "license.ban" // ban/unban/revoke
  | "license.extend"
  | "license.reset_hwid"
  // analytics / security / audit
  | "analytics.read"
  | "security.read"
  | "audit.read"
  // admins
  | "admin.read"
  | "admin.write"
  // settings
  | "settings.read"
  | "settings.write";

const ALL: Permission[] = [
  "app.read",
  "app.write",
  "package.read",
  "package.write",
  "license.read",
  "license.generate",
  "license.ban",
  "license.extend",
  "license.reset_hwid",
  "analytics.read",
  "security.read",
  "audit.read",
  "admin.read",
  "admin.write",
  "settings.read",
  "settings.write",
];

// The matrix, most-privileged first. Kept as data so the Settings/Admins UI can
// render exactly what a role can do without duplicating the rules.
const MATRIX: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: [
    "app.read",
    "app.write",
    "package.read",
    "package.write",
    "license.read",
    "license.generate",
    "license.ban",
    "license.extend",
    "license.reset_hwid",
    "analytics.read",
    "security.read",
    "audit.read",
    "settings.read",
  ],
  SUPPORT: [
    "app.read",
    "package.read",
    "license.read",
    "license.reset_hwid", // support can unbind a machine for a customer
    "analytics.read",
    "security.read",
  ],
  READ_ONLY: [
    "app.read",
    "package.read",
    "license.read",
    "analytics.read",
    "security.read",
    "audit.read",
  ],
};

export function permissionsFor(role: AdminRole): Permission[] {
  return MATRIX[role];
}

export function can(role: AdminRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}
