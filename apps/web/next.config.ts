import path from "node:path";

import type { NextConfig } from "next";

// Performance Recovery Task — Turbopack walks up the filesystem looking for
// a lockfile to infer the workspace root, and can land on an unrelated
// lockfile further up the tree (e.g. a stray `pnpm-lock.yaml` in the user's
// home directory) instead of this monorepo's actual root. That produced
// the "Next.js inferred your workspace root, but it may not be correct"
// dev-time warning. Setting `turbopack.root` explicitly removes the
// guesswork; this affects development tooling/module resolution only and
// has no effect on request-handling time.
const workspaceRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@hu/types", "@hu/media-registry", "@hu/geography"],
  turbopack: {
    root: workspaceRoot,
  },
  async redirects() {
    return [
      {
        source: "/knowledge/media",
        destination: "/media",
        permanent: true,
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
    ];

    // HSTS only when explicitly enabled — requires understood HTTPS termination.
    if (process.env.ENABLE_HSTS === "true") {
      securityHeaders.push({
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      });
    }

    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ".js": [".ts", ".tsx", ".js"],
      ".jsx": [".tsx", ".jsx"],
    };
    return config;
  },
};

export default nextConfig;
