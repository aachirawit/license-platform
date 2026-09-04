import type { App } from "@prisma/client";

import { KeyAuthProvider } from "./keyauth-provider";
import { MockLicenseProvider } from "./mock-provider";
import type { LicenseProvider } from "./provider";

// The mock provider is stateless (it reaches into Prisma per call), so one
// shared instance is fine and avoids re-allocating per request.
const mockProvider = new MockLicenseProvider();

/**
 * Resolve the licence provider for an app. This is the ONLY place that maps a
 * provider kind to a concrete class - API routes, services and components call
 * getLicenseProvider(app) and then use the interface, so no provider-specific
 * branching leaks into handlers or React.
 */
export function getLicenseProvider(app: Pick<App, "provider" | "providerConfig">): LicenseProvider {
  switch (app.provider) {
    case "MOCK":
      return mockProvider;
    case "KEYAUTH":
      // A KeyAuth adapter is per-app (each app has its own KeyAuth config), so
      // it is constructed fresh. It fails safely until implemented.
      return new KeyAuthProvider(app.providerConfig);
    default: {
      // Exhaustiveness guard: a new provider kind will fail the type check here
      // until it is wired in, rather than silently falling through.
      const never: never = app.provider;
      throw new Error(`Unknown licence provider: ${String(never)}`);
    }
  }
}
