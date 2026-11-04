import path from "node:path";

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
  // SEO-09 — Resolve metadata before streaming for every user agent so
  // title/description/canonical/robots/hreflang/OG/Twitter render inside
  // <head>. Next's default only does this for its HTML-limited bot list,
  // which excludes browsers and Googlebot and leaves those tags in <body>.
  htmlLimitedBots: /.*/,
  async redirects() {
    return [
      {
        source: "/knowledge/media",
        destination: "/media",
        permanent: true,
      },
      // SEO-BING-01.3 — owner-approved legacy WordPress article URLs (exact paths only).
      {
        source: "/who-owns-the-earth",
        destination: "/blog/who-owns-the-earth",
        permanent: true,
      },
      {
        source: "/breaking-stereotypes",
        destination: "/blog/breaking-stereotypes",
        permanent: true,
      },
      {
        source: "/world-protection-corps",
        destination: "/blog/world-protection-corps",
        permanent: true,
      },
      {
        source: "/leader",
        destination: "/blog/leader",
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

// Pack 02D Task 01 — next-intl without locale-prefixed routing / middleware.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
