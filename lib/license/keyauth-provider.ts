import type { LicenseProvider } from "./provider";
import {
  ProviderUnavailableError,
  type ActivationResult,
  type GenerateLicenseInput,
  type GeneratedLicense,
  type GetLicensesInput,
  type GetLicensesResult,
  type ProviderLicense,
} from "./types";

/**
 * KeyAuth adapter — INTENTIONALLY NOT IMPLEMENTED.
 *
 * This class exists so the rest of the platform can be written against the
 * LicenseProvider interface today, and so switching an app from MOCK to KEYAUTH
 * later is a config change plus filling in the methods below — not a rewrite of
 * the dashboard or the API routes.
 *
 * It is deliberately empty of real calls. Inventing KeyAuth endpoints that have
 * not been verified against their current documentation would be worse than
 * nothing: it would compile, look done, and fail in production. Every method
 * therefore fails safely with ProviderUnavailableError until implemented, and
 * the factory only ever returns this provider for an app explicitly set to
 * KEYAUTH — MOCK apps are unaffected.
 *
 * To implement (when a KeyAuth account exists), against the CURRENT official
 * KeyAuth Seller/API docs only:
 *   - constructor: read the app's providerConfig (name, ownerid, version) plus
 *     the seller key from a server-side env var (never from the browser, never
 *     from a License row in plaintext).
 *   - generateLicenses -> KeyAuth "add licence" seller call; map its returned
 *     keys into GeneratedLicense, hashing/masking on our side as usual.
 *   - getLicense/getLicenses -> KeyAuth licence listing; cache the metadata
 *     into our License table keyed by providerLicenseId so the dashboard stays
 *     fast and KeyAuth stays authoritative.
 *   - ban/unban/reset/revoke/extend -> the matching seller operations.
 *   - activate -> the client licence-verify flow (this is what SZK's C++ client
 *     already speaks; see the SZK repo's keyauth.cpp for the request shape).
 *
 * Until each method is verified and implemented, leave it throwing.
 */
export class KeyAuthProvider implements LicenseProvider {
  readonly kind = "KEYAUTH" as const;

  constructor(private readonly config: unknown) {
    // config comes from App.providerConfig (non-secret) plus server env; kept
    // for the future implementation. Referenced to satisfy noUnusedParameters.
    void this.config;
  }

  private unavailable(): never {
    throw new ProviderUnavailableError(
      "KEYAUTH",
      "adapter not implemented yet; keep this app on the MOCK provider",
    );
  }

  generateLicenses(_input: GenerateLicenseInput): Promise<GeneratedLicense[]> {
    void _input;
    this.unavailable();
  }
  getLicense(_id: string): Promise<ProviderLicense | null> {
    void _id;
    this.unavailable();
  }
  getLicenses(_input: GetLicensesInput): Promise<GetLicensesResult> {
    void _input;
    this.unavailable();
  }
  banLicense(_id: string, _reason?: string): Promise<ProviderLicense> {
    void _id;
    void _reason;
    this.unavailable();
  }
  unbanLicense(_id: string): Promise<ProviderLicense> {
    void _id;
    this.unavailable();
  }
  resetHwid(_id: string): Promise<ProviderLicense> {
    void _id;
    this.unavailable();
  }
  revokeLicense(_id: string, _reason?: string): Promise<ProviderLicense> {
    void _id;
    void _reason;
    this.unavailable();
  }
  extendLicense(_id: string, _days: number): Promise<ProviderLicense> {
    void _id;
    void _days;
    this.unavailable();
  }
  activate(_input: {
    appId: string;
    rawKey: string;
    rawHwid: string;
    ip?: string;
  }): Promise<ActivationResult> {
    void _input;
    this.unavailable();
  }
}
