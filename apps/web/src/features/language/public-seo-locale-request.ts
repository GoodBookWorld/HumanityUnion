/**
 * Pack 2.1A — derive URL locale segment from request signals (no Next imports).
 *
 * Precedence for URL authority signals:
 *   1. pathname via existing `parsePublicSeoLocalePrefixedPath` (SEO perimeter + reserved gates)
 *   2. explicit `x-hu-url-locale-segment` header when present
 *
 * Registry enabled/seoIndexingEnabled gating happens in `resolvePublicSeoLocaleDocument`.
 */

import { parsePublicSeoLocalePrefixedPath } from "@hu/types";

export function resolveUrlLocaleSegmentFromRequestSignals(input: {
  readonly pathname?: string | null;
  readonly urlLocaleSegmentHeader?: string | null;
}): string | null {
  const pathname =
    typeof input.pathname === "string" && input.pathname.trim().length > 0
      ? input.pathname.trim()
      : null;

  if (pathname) {
    const parsed = parsePublicSeoLocalePrefixedPath(pathname);
    if (parsed?.segment) {
      return parsed.segment;
    }
  }

  const fromHeader =
    typeof input.urlLocaleSegmentHeader === "string"
      ? input.urlLocaleSegmentHeader.trim()
      : "";
  return fromHeader.length > 0 ? fromHeader : null;
}

/**
 * Pack 2.1A — client sync must not force a conflicting language onto a
 * valid locale-prefixed SEO public document URL.
 */
export function shouldSuppressInterfaceLanguageCookieSyncForPath(
  pathname: string | null | undefined,
): boolean {
  if (typeof pathname !== "string" || pathname.trim().length === 0) {
    return false;
  }
  return parsePublicSeoLocalePrefixedPath(pathname.trim()) !== null;
}
