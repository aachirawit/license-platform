import type { NextConfig } from "next";

// Content-Security-Policy.
//
// A per-request nonce with 'strict-dynamic' is the strongest option, but it
// requires every page to be dynamically rendered - a nonce cannot be injected
// into a statically prerendered page like /login or the 404. Rather than force
// the whole app dynamic and lose that optimisation, we ship a static policy
// that works with prerendering. script-src therefore allows 'unsafe-inline'
// for Next's hydration bootstrap; React escapes rendered output, so the higher-
// impact vectors are closed elsewhere in the policy: no framing, no plugin
// content, locked base-uri, and forms may only post back to our own origin.
// 'unsafe-eval' is added ONLY in development, where React Fast Refresh needs
// it; a production build never includes it.
const isDev = process.env.NODE_ENV !== "production";
const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' blob: data:`,
  `font-src 'self'`,
  `connect-src 'self'`,
  `object-src 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
  `upgrade-insecure-requests`,
].join("; ");

// Baseline security response headers applied to every route.
const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Force HTTPS for two years, including subdomains. Harmless on localhost
  // (browsers ignore HSTS over http), meaningful the moment the app is on TLS.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Never let the browser guess a response's content type.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Legacy clickjacking guard for browsers that ignore CSP frame-ancestors.
  { key: "X-Frame-Options", value: "DENY" },
  // Leak only the origin (not the path/query) on cross-origin navigations.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // This app needs none of these device APIs; deny them outright.
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  // Isolate this origin from cross-origin popups it opens.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Hide the framework fingerprint.
  poweredByHeader: false,
  // argon2 is a native module; keep it out of the client/edge bundle. It only
  // ever runs in Node route handlers (password hashing), never in the browser.
  serverExternalPackages: ["argon2", "@prisma/client"],
  eslint: {
    // Lint is a separate CI step; a lint warning should not block a deploy.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
