/**
 * SEO-11A — environment values the Admin SEO / Platform diagnostics read.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` and `process.env.NODE_ENV` into
 * browser bundles only when referenced directly as below. The browser
 * `process.env` object itself is empty, so passing `process.env` as a whole made
 * client-side diagnostics report a missing site origin and development mode on
 * Production. Unset values stay undefined; normalization belongs to the
 * resolvers (`resolvePublicSiteOrigin`, `resolvePlatformIndexingMode`).
 */
export type PublicBuildEnv = {
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly NEXT_PUBLIC_PLATFORM_MODE?: string;
  /** Server-only fallback already honoured by resolvePlatformIndexingMode; undefined in browsers. */
  readonly PLATFORM_MODE?: string;
  readonly NODE_ENV?: string;
};

export function readPublicBuildEnv(): PublicBuildEnv {
  return {
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_PLATFORM_MODE: process.env.NEXT_PUBLIC_PLATFORM_MODE,
    PLATFORM_MODE: process.env.PLATFORM_MODE,
    NODE_ENV: process.env.NODE_ENV,
  };
}
