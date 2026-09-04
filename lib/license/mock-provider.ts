import type { License as DbLicense, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/prisma";
import {
  encryptKey,
  generateLicenseKey,
  hashHwid,
  hashLicenseKey,
  keyPrefixOf,
} from "@/lib/security/crypto";

import type { LicenseProvider } from "./provider";
import type {
  ActivationResult,
  GenerateLicenseInput,
  GeneratedLicense,
  GetLicensesInput,
  GetLicensesResult,
  ProviderLicense,
} from "./types";

/**
 * A fully functional provider backed by this platform's own Postgres. It is
 * the authoritative licence engine for any app whose provider is MOCK, so the
 * dashboard is completely usable with no external account. Every operation is a
 * real database write - there is no frontend-only state.
 */
export class MockLicenseProvider implements LicenseProvider {
  readonly kind = "MOCK" as const;

  // ── Mapping ────────────────────────────────────────────────────────────────

  /** Row -> provider shape. Deliberately drops keyHash and hwidHash. */
  private toProvider(row: DbLicense): ProviderLicense {
    const status = this.effectiveStatus(row);
    return {
      id: row.id,
      appId: row.appId,
      provider: "MOCK",
      providerLicenseId: row.providerLicenseId ?? row.id,
      keyPrefix: row.keyPrefix,
      name: row.name,
      packageId: row.packageId,
      status,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      activatedAt: row.activatedAt?.toISOString() ?? null,
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      hwidBound: row.hwidHash !== null,
      hwidResetCount: row.hwidResetCount,
      keyAvailable: row.keyCipher !== null,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      note: row.note,
    };
  }

  /**
   * Expiry is derived, not just stored: a licence past expiresAt reads as
   * EXPIRED even if its column still says ACTIVE, so the dashboard never shows a
   * stale "active" for a lapsed key. BANNED/REVOKED always win over expiry.
   */
  private effectiveStatus(row: DbLicense): ProviderLicense["status"] {
    if (row.status === "BANNED" || row.status === "REVOKED") return row.status;
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return "EXPIRED";
    return row.status;
  }

  private async loadOwned(id: string): Promise<DbLicense> {
    const row = await prisma.license.findUnique({ where: { id } });
    if (!row) throw new Error("LICENSE_NOT_FOUND");
    return row;
  }

  // ── Generation ───────────────────────────────────────────────────────────────

  async generateLicenses(input: GenerateLicenseInput): Promise<GeneratedLicense[]> {
    // Custom key: exactly one, the admin-supplied value. A collision means that
    // key already exists - surface it rather than retrying a fixed value.
    if (input.customKey) {
      const rawKey = input.customKey.trim().toUpperCase();
      try {
        const row = await this.insertKey(input, rawKey);
        return [{ license: this.toProvider(row), plaintextKey: rawKey }];
      } catch (err) {
        if (this.isUniqueViolation(err)) throw new Error("KEY_EXISTS");
        throw err;
      }
    }

    const quantity = Math.max(1, Math.min(input.quantity, 500));
    const results: GeneratedLicense[] = [];

    // Each key is generated, hashed, encrypted, and inserted. On the
    // astronomically unlikely hash collision (unique constraint), retry.
    for (let i = 0; i < quantity; i++) {
      let row: DbLicense | null = null;
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        const rawKey = generateLicenseKey(input.keyPrefix);
        try {
          row = await this.insertKey(input, rawKey);
          results.push({ license: this.toProvider(row), plaintextKey: rawKey });
        } catch (err) {
          if (this.isUniqueViolation(err)) continue; // collision: retry
          throw err;
        }
      }
      if (!row) throw new Error("KEY_GENERATION_FAILED");
    }

    return results;
  }

  /** Insert one licence row for a raw key, storing hash + encrypted copy. */
  private async insertKey(input: GenerateLicenseInput, rawKey: string): Promise<DbLicense> {
    const created = await prisma.license.create({
      data: {
        appId: input.appId,
        provider: "MOCK",
        keyHash: hashLicenseKey(rawKey),
        keyCipher: encryptKey(rawKey),
        keyPrefix: keyPrefixOf(rawKey),
        packageId: input.packageId,
        status: "UNUSED",
        expiresAt: this.expiryFromDays(input.durationDays),
      },
    });
    // providerLicenseId mirrors the row id for the mock backend.
    return prisma.license.update({
      where: { id: created.id },
      data: { providerLicenseId: created.id },
    });
  }

  private expiryFromDays(days: number | null): Date | null {
    if (!days || days <= 0) return null; // lifetime
    return new Date(Date.now() + days * 86_400_000);
  }

  private isUniqueViolation(err: unknown): boolean {
    return (
      typeof err === "object" &&
      err !== null &&
      (err as { code?: string }).code === "P2002"
    );
  }

  // ── Reads ────────────────────────────────────────────────────────────────────

  async getLicense(id: string): Promise<ProviderLicense | null> {
    const row = await prisma.license.findUnique({ where: { id } });
    return row ? this.toProvider(row) : null;
  }

  async getLicenses(input: GetLicensesInput): Promise<GetLicensesResult> {
    const where: Prisma.LicenseWhereInput = { appId: input.appId };

    if (input.status) {
      // EXPIRED is derived, so translate it into a time predicate rather than a
      // status equality the column may not carry yet.
      if (input.status === "EXPIRED") {
        where.status = { in: ["ACTIVE", "UNUSED"] };
        where.expiresAt = { not: null, lte: new Date() };
      } else {
        where.status = input.status;
      }
    }
    if (input.packageId) where.packageId = input.packageId;
    if (input.search) {
      const q = input.search.trim();
      // Match any of: the exact full key by its HMAC (deterministic, so pasting a
      // customer's complete key - custom or generated - finds it without the key
      // ever being searchable in the clear), the visible prefix, or the name.
      where.OR = [
        { keyHash: hashLicenseKey(q) },
        { keyPrefix: { contains: q.toUpperCase() } },
        { name: { contains: q, mode: "insensitive" } },
      ];
    }
    if (input.createdAfter || input.createdBefore) {
      where.createdAt = {};
      if (input.createdAfter) where.createdAt.gte = input.createdAfter;
      if (input.createdBefore) where.createdAt.lte = input.createdBefore;
    }

    const [rows, total] = await Promise.all([
      prisma.license.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(input.limit, 100),
        skip: input.offset,
      }),
      prisma.license.count({ where }),
    ]);

    return { licenses: rows.map((r) => this.toProvider(r)), total };
  }

  // ── Mutations ────────────────────────────────────────────────────────────────

  async banLicense(id: string, reason?: string): Promise<ProviderLicense> {
    await this.loadOwned(id);
    const row = await prisma.license.update({
      where: { id },
      data: { status: "BANNED", note: reason ?? null },
    });
    return this.toProvider(row);
  }

  async unbanLicense(id: string): Promise<ProviderLicense> {
    const current = await this.loadOwned(id);
    // Unbanning returns the licence to ACTIVE if it was ever activated, else
    // UNUSED; expiry is re-derived on read.
    const row = await prisma.license.update({
      where: { id },
      data: {
        status: current.activatedAt ? "ACTIVE" : "UNUSED",
        note: null,
      },
    });
    return this.toProvider(row);
  }

  async resetHwid(id: string): Promise<ProviderLicense> {
    await this.loadOwned(id);
    // Atomic clear + increment, so two concurrent resets cannot both read the
    // old count and write the same +1.
    const row = await prisma.license.update({
      where: { id },
      data: { hwidHash: null, hwidResetCount: { increment: 1 } },
    });
    return this.toProvider(row);
  }

  async revokeLicense(id: string, reason?: string): Promise<ProviderLicense> {
    await this.loadOwned(id);
    const row = await prisma.license.update({
      where: { id },
      data: { status: "REVOKED", note: reason ?? null },
    });
    return this.toProvider(row);
  }

  async extendLicense(id: string, days: number): Promise<ProviderLicense> {
    const current = await this.loadOwned(id);
    // Extend from the later of now and the current expiry, so extending an
    // already-lapsed key gives the full new window rather than backdating it.
    const base =
      current.expiresAt && current.expiresAt.getTime() > Date.now()
        ? current.expiresAt.getTime()
        : Date.now();
    const row = await prisma.license.update({
      where: { id },
      data: { expiresAt: new Date(base + days * 86_400_000) },
    });
    return this.toProvider(row);
  }

  // ── Client activation ──────────────────────────────────────────────────────

  async activate(input: {
    appId: string;
    rawKey: string;
    rawHwid: string;
    ip?: string;
  }): Promise<ActivationResult> {
    const row = await prisma.license.findUnique({
      where: { keyHash: hashLicenseKey(input.rawKey) },
    });

    // Unknown key, or a key belonging to a different app: same generic answer,
    // so a caller cannot probe which apps a key is valid for.
    if (!row || row.appId !== input.appId) return { ok: false, code: "INVALID_LICENSE" };
    if (row.status === "BANNED") return { ok: false, code: "LICENSE_BANNED" };
    if (row.status === "REVOKED") return { ok: false, code: "LICENSE_REVOKED" };
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now())
      return { ok: false, code: "LICENSE_EXPIRED" };

    const incomingHwid = hashHwid(input.rawHwid);
    if (row.hwidHash && row.hwidHash !== incomingHwid) {
      // The bound HWID is never revealed to the client; only that it mismatched.
      return { ok: false, code: "HWID_MISMATCH" };
    }

    const updated = await prisma.license.update({
      where: { id: row.id },
      data: {
        status: "ACTIVE",
        hwidHash: row.hwidHash ?? incomingHwid, // bind on first use
        activatedAt: row.activatedAt ?? new Date(),
        lastUsedAt: new Date(),
        lastIp: input.ip ?? row.lastIp,
      },
    });

    return { ok: true, license: this.toProvider(updated) };
  }
}
