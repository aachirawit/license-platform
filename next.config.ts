import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // argon2 is a native module; keep it out of the client/edge bundle. It only
  // ever runs in Node route handlers (password hashing), never in the browser.
  serverExternalPackages: ["argon2", "@prisma/client"],
  eslint: {
    // Lint is a separate CI step; a lint warning should not block a deploy.
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
