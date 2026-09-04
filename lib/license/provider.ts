import type {
  ActivationResult,
  GenerateLicenseInput,
  GeneratedLicense,
  GetLicensesInput,
  GetLicensesResult,
  ProviderLicense,
} from "./types";

/**
 * The contract every licence backend implements. The dashboard, the API routes
 * and the services above them depend ONLY on this interface - never on a
 * concrete provider - so a new backend is added by writing one class, not by
 * touching the UI or the route handlers.
 *
 * Rules for implementers:
 *   - All mutating operations are scoped by the licence id, which the caller
 *     has already confirmed belongs to the correct app. A provider must still
 *     treat ids as untrusted and fail safely on an unknown id.
 *   - Never return a plaintext key except from generateLicenses().
 *   - Never return a raw HWID or its hash; expose only `hwidBound`.
 *   - Throw ProviderUnavailableError when the backend is not configured rather
 *     than pretending an operation succeeded.
 */
export interface LicenseProvider {
  readonly kind: "MOCK" | "KEYAUTH";

  /** Create N licences. The only path that yields plaintext keys. */
  generateLicenses(input: GenerateLicenseInput): Promise<GeneratedLicense[]>;

  /** One licence by platform id, or null if it does not exist. */
  getLicense(id: string): Promise<ProviderLicense | null>;

  /** A page of licences for one app, with the total for pagination. */
  getLicenses(input: GetLicensesInput): Promise<GetLicensesResult>;

  banLicense(id: string, reason?: string): Promise<ProviderLicense>;
  unbanLicense(id: string): Promise<ProviderLicense>;

  /** Clear the machine binding and bump the reset counter. */
  resetHwid(id: string): Promise<ProviderLicense>;

  /** Permanently kill a licence. Not reversible. */
  revokeLicense(id: string, reason?: string): Promise<ProviderLicense>;

  /** Add days to the expiry (or from now if already expired/lifetime start). */
  extendLicense(id: string, days: number): Promise<ProviderLicense>;

  /**
   * Client-facing: check a raw key + hwid and bind on first use. Used by the
   * C++/API auth path, not the admin dashboard. Kept on the provider so an
   * external backend can own activation when it is authoritative.
   */
  activate(input: {
    appId: string;
    rawKey: string;
    rawHwid: string;
    ip?: string;
  }): Promise<ActivationResult>;
}
