// The provider-facing licence shape. This is deliberately NOT the Prisma model:
// the dashboard and API talk in these terms so that swapping MOCK for an
// external provider (KeyAuth) later changes nothing above this line.

export type ProviderKind = "MOCK" | "KEYAUTH";

export type LicenseStatus =
  | "UNUSED"
  | "ACTIVE"
  | "EXPIRED"
  | "BANNED"
  | "REVOKED";

export interface ProviderLicense {
  /** The platform's licence id (Prisma License.id). */
  id: string;
  appId: string;
  provider: ProviderKind;
  /** The provider's own id; equals `id` for MOCK. */
  providerLicenseId: string | null;
  /** Masked display form, e.g. "SZKP-7X2K". Never the full key. */
  keyPrefix: string;
  packageId: string | null;
  status: LicenseStatus;
  /** ISO string, or null for lifetime. */
  expiresAt: string | null;
  activatedAt: string | null;
  lastUsedAt: string | null;
  /** True when a machine is bound. The hash itself is never exposed. */
  hwidBound: boolean;
  hwidResetCount: number;
  createdAt: string;
  updatedAt: string;
  note: string | null;
}

/**
 * The one time a plaintext key crosses the provider boundary: the result of
 * generation, shown to the admin exactly once and never persisted in the clear.
 */
export interface GeneratedLicense {
  license: ProviderLicense;
  /** Plaintext key. Present ONLY in a generation result. */
  plaintextKey: string;
}

export interface GenerateLicenseInput {
  appId: string;
  /** App-specific prefix, e.g. "SZKP". */
  keyPrefix: string;
  quantity: number;
  /** 0 or null = lifetime. */
  durationDays: number | null;
  packageId: string | null;
}

export interface GetLicensesInput {
  appId: string;
  status?: LicenseStatus;
  packageId?: string;
  /** Substring match against the key prefix, e.g. "SZKP-7X2K". */
  search?: string;
  createdBefore?: Date;
  createdAfter?: Date;
  limit: number;
  offset: number;
}

export interface GetLicensesResult {
  licenses: ProviderLicense[];
  total: number;
}

/**
 * Result of a client attempting to authenticate a key against the provider.
 * Used by the (future) C++-facing auth route, not the admin dashboard.
 */
export type ActivationResult =
  | { ok: true; license: ProviderLicense }
  | {
      ok: false;
      code:
        | "INVALID_LICENSE"
        | "LICENSE_EXPIRED"
        | "LICENSE_BANNED"
        | "LICENSE_REVOKED"
        | "HWID_MISMATCH";
    };

/**
 * A provider that cannot perform an operation (e.g. the KeyAuth adapter before
 * it is configured) throws this rather than returning a fake success, so the
 * failure is explicit and the API can surface a clean "provider unavailable".
 */
export class ProviderUnavailableError extends Error {
  constructor(provider: ProviderKind, detail?: string) {
    super(
      `The ${provider} licence provider is not available${detail ? `: ${detail}` : ""}.`,
    );
    this.name = "ProviderUnavailableError";
  }
}
