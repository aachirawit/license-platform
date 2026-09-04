import { prisma } from "@/lib/db/prisma";
import { Errors } from "@/lib/http/errors";
import { decryptKey } from "@/lib/security/crypto";
import { getLicenseProvider } from "@/lib/license/factory";
import type { ActivationResult, GeneratedLicense, ProviderLicense } from "@/lib/license/types";
import { getAppOrThrow } from "./app-service";
import { writeAudit } from "./audit-service";
import { recordSecurityEvent, type SecurityEventType } from "./security-service";
import { notifyDiscord } from "@/lib/discord/discord-service";
import type { ActivateInput, GenerateLicensesInput, LicenseFilters } from "@/lib/validation/license";

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
  let generated: GeneratedLicense[];
  try {
    generated = await provider.generateLicenses({
      appId: app.id,
      keyPrefix: app.keyPrefix ?? app.appId.slice(0, 4),
      // A custom key always produces exactly one licence.
      quantity: input.customKey ? 1 : input.quantity,
      durationDays,
      packageId: input.packageId ?? null,
      customKey: input.customKey ?? null,
    });
  } catch (err) {
    if (err instanceof Error && err.message === "KEY_EXISTS") {
      throw Errors.conflict("That key already exists. Choose a different one.");
    }
    throw err;
  }

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

  // Optional Discord notice for a new batch (fire-and-forget, masked, no-op if
  // the webhook is unset). Not a security event - just an operational heads-up.
  void notifyDiscord({
    type: "LICENSE_GENERATED",
    severity: "LOW",
    appId: app.appId,
    message: `${generated.length} license(s) generated for ${app.name}`,
  });

  return generated;
}

/**
 * Public key activation for desktop clients. Unauthenticated: no admin, no app
 * ownership implied. The app is resolved by its PUBLIC appId column, and every
 * failure returns the provider's generic code so the endpoint cannot be used as
 * an oracle for which apps or keys exist. Notable refusals are recorded as
 * security events (and HWID mismatches / banned attempts raise an alert), since
 * this is exactly where key sharing and brute force show up.
 */
export async function activateLicense(
  input: ActivateInput,
  ip: string | null,
): Promise<ActivationResult> {
  // Resolve by the public appId (e.g. "SZKOPT"), not the internal cuid. An
  // unknown app looks identical to an unknown key: generic INVALID_LICENSE.
  const app = await prisma.app.findUnique({ where: { appId: input.appId } });
  if (!app) return { ok: false, code: "INVALID_LICENSE" };

  const result = await getLicenseProvider(app).activate({
    appId: app.id,
    rawKey: input.key,
    rawHwid: input.hwid,
    ip: ip ?? undefined,
  });

  if (!result.ok) {
    const typeByCode: Record<typeof result.code, SecurityEventType> = {
      INVALID_LICENSE: "INVALID_LICENSE",
      LICENSE_EXPIRED: "LICENSE_EXPIRED_ATTEMPT",
      LICENSE_BANNED: "LICENSE_BANNED_ATTEMPT",
      LICENSE_REVOKED: "LICENSE_BANNED_ATTEMPT",
      HWID_MISMATCH: "HWID_MISMATCH",
    };
    // INVALID_LICENSE is the brute-force signature - noisy, so LOW. A mismatch
    // or a hit on a banned/revoked key is the higher-signal, alert-worthy case.
    const highSignal = result.code === "HWID_MISMATCH" || result.code === "LICENSE_BANNED";
    await recordSecurityEvent({
      type: typeByCode[result.code],
      severity: result.code === "INVALID_LICENSE" ? "LOW" : "MEDIUM",
      appId: app.id,
      ip,
      message: `Activation refused (${result.code}) for app ${app.appId}`,
      alert: highSignal,
    });
  }

  return result;
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

/**
 * Decrypt and return the full plaintext key for copy/reveal. Only works for keys
 * stored with an encrypted copy (keyCipher); older keys return null. This exposes
 * a secret, so it is a privileged, audited action.
 */
export async function revealLicenseKey(id: string, ctx: ActionContext): Promise<string> {
  const row = await prisma.license.findUnique({
    where: { id },
    include: { app: true },
  });
  if (!row) throw Errors.notFound("LICENSE_NOT_FOUND", "License not found");
  if (!row.keyCipher) {
    throw Errors.invalid("This key predates encrypted storage and cannot be revealed.");
  }

  let plaintext: string;
  try {
    plaintext = decryptKey(row.keyCipher);
  } catch {
    // Decryption fails if the encryption secret changed since the key was
    // stored. Surface a clean message instead of a 500.
    throw Errors.invalid("This key cannot be decrypted (the encryption secret changed).");
  }

  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_KEY_REVEALED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { licensePrefix: row.keyPrefix },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  await recordSecurityEvent({
    type: "SUSPICIOUS_ACTIVITY",
    severity: "LOW",
    appId: row.appId,
    licensePrefix: row.keyPrefix,
    ip: ctx.ip,
    message: `Full key for ${row.keyPrefix} was revealed by an admin`,
    alert: false,
  });

  return plaintext;
}

export async function renameLicense(id: string, name: string, ctx: ActionContext) {
  const row = await loadAppForLicense(id);
  const trimmed = name.trim();
  const updated = await prisma.license.update({
    where: { id },
    data: { name: trimmed === "" ? null : trimmed },
  });
  await writeAudit({
    adminId: ctx.adminId,
    action: "LICENSE_RENAMED",
    appId: row.appId,
    targetType: "License",
    targetId: id,
    metadata: { licensePrefix: row.keyPrefix, name: updated.name },
    ip: ctx.ip,
    userAgent: ctx.userAgent,
  });
  return getLicenseProvider(row.app).getLicense(id);
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
