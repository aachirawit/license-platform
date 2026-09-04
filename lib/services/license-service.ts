import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import { getLicenseProvider } from "@/lib/license/factory";
import type { GeneratedLicense, ProviderLicense } from "@/lib/license/types";
import { getAppOrThrow } from "./app-service";
import { writeAudit } from "./audit-service";
import { recordSecurityEvent } from "./security-service";
import type { GenerateLicensesInput, LicenseFilters } from "@/lib/validation/license";

// The one place UI/API talk to for licences. It resolves the app's provider via
// the factory and adds the platform concerns the provider does not own: app
// scoping, audit trail, and security events. Nothing here branches on which
// provider is in use - that is the whole point of the abstraction.

interface ActionContext {
  adminId: string;
  ip: string | null;
  userAgent: string | null;
}

/** List licences for one app (by id or slug), paginated + filtered. */
export async function listLicenses(appIdOrSlug: string, filters: LicenseFilters) {
  const app = await getAppOrThrow(appIdOrSlug);
  const provider = getLicenseProvider(app);

  const { licenses, total } = await provider.getLicenses({
    appId: app.id,
    status: filters.status,
    packageId: filters.packageId,
    search: filters.search,
    limit: filters.pageSize,
    offset: (filters.page - 1) * filters.pageSize,
  });

  return {
    appId: app.id,
    licenses,
    total,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(total / filters.pageSize)),
  };
}

/** One licence with its owning app + package names for the detail view. */
export async function getLicenseDetail(id: string): Promise<{
  license: ProviderLicense;
  appName: string;
  appSlug: string;
  packageName: string | null;
}> {
  const row = await prisma.license.findUnique({
    where: { id },
    include: { app: true, package: true },
  });
  if (!row) throw Errors.notFound("LICENSE_NOT_FOUND", "License not found");

  const provider = getLicenseProvider(row.app);
  const license = await provider.getLicense(id);
  if (!license) throw Errors.notFound("LICENSE_NOT_FOUND", "License not found");

  return {
    license,
    appName: row.app.name,
    appSlug: row.app.slug,
    packageName: row.package?.name ?? null,
  };
}

/**
 * Generate keys. Resolves the effective duration (explicit override, else the
 * package's duration, else lifetime) and returns the plaintext keys ONCE.
 */
export async function generateLicenses(
  appIdOrSlug: string,
  input: GenerateLicensesInput,
  ctx: ActionContext,
): Promise<GeneratedLicense[]> {
  const app = await getAppOrThrow(appIdOrSlug);

  let durationDays: number | null = input.durationDays ?? null;
  if (durationDays === null && input.packageId) {
    const pkg = await prisma.licensePackage.findUnique({ where: { id: input.packageId } });
    if (!pkg || pkg.appId !== app.id) {
      throw Errors.notFound("PACKAGE_NOT_FOUND", "Package not found for this application");
    }
    durationDays = pkg.durationDays; // 0 stays lifetime
  }

  const provider = getLicenseProvider(app);
  const generated = await provider.generateLicenses({
    appId: app.id,
    keyPrefix: app.keyPrefix ?? app.appId.slice(0, 4),
    quantity: input.quantity,
    durationDays,
    packageId: input.packageId ?? null,
  });

  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_GENERATED",
    appId: app.id,
    targetType: "License",
    metadata: {
      quantity: generated.length,
      packageId: input.packageId ?? null,
      durationDays,
    },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });

  return generated;
}

// ── Single-licence actions ────────────────────────────────────────────────────
// Each loads the licence's owning app (for the provider), performs the provider
// call, then records audit + (where relevant) a security event.

async function loadAppForLicense(id: string) {
  const row = await prisma.license.findUnique({
    where: { id },
    include: { app: true },
  });
  if (!row) throw Errors.notFound("LICENSE_NOT_FOUND", "License not found");
  return row;
}

export async function banLicense(id: string, reason: string | undefined, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const result = await getLicenseProvider(row.app).banLicense(id, reason);
  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_BANNED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { reason: reason ?? null, licensePrefix: row.keyPrefix },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

export async function unbanLicense(id: string, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const result = await getLicenseProvider(row.app).unbanLicense(id);
  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_UNBANNED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { licensePrefix: row.keyPrefix },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

export async function resetHwid(id: string, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const result = await getLicenseProvider(row.app).resetHwid(id);
  await writeAudit({
    adminId: ctx.adminId,
    action: "HWID_RESET",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { licensePrefix: row.keyPrefix, resetCount: result.hwidResetCount },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await recordSecurityEvent({
    type: "HWID_RESET",
    severity: "LOW",
    appId: row.appId,
    licensePrefix: row.keyPrefix,
    ip: ctx.ip,
    message: `HWID reset for ${row.keyPrefix} by an admin`,
    alert: true,
  });
  return result;
}

export async function revokeLicense(id: string, reason: string | undefined, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const result = await getLicenseProvider(row.app).revokeLicense(id, reason);
  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_REVOKED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { reason: reason ?? null, licensePrefix: row.keyPrefix },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}

export async function extendLicense(id: string, days: number, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const result = await getLicenseProvider(row.app).extendLicense(id, days);
  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_EXTENDED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { days, licensePrefix: row.keyPrefix, expiresAt: result.expiresAt },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return result;
}
