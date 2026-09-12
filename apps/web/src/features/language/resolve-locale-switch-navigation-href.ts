/**
 * Locale-switch navigation for SEO-prefixed public routes.
 * Pure helper — no React / next-intl dependency.
 *
 * Registry-driven: SEO-indexable locales may use `/{normalizedSegment}{path}`.
 * Enabled but non-SEO locales stay on the locale-free public path (cookie + refresh).
 * English/default platform language uses the locale-free public path.
 * No finite current-locale route map.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  isPublicSeoLocalePath,
  normalizeLanguageRegistryLocaleKey,
  parsePublicSeoLocalePrefixedPath,
  toPublicSeoLocaleUrlSegment,
} from "@hu/types";

/**
 * Build the navigation target after a language switch so SEO-prefixed routes
 * cannot keep the old URL locale while the selector claims a different locale.
 *
 * - Default platform language → locale-free public path (/media).
 * - Enabled + SEO-indexable → /{segment}{path} (e.g. /uk/media).
 * - Enabled + non-SEO → locale-free path (never /{locale}/…); cookie carries interface locale.
 * - Non-SEO routes (workspace, etc.) → null (cookie + refresh only).
 */
export function resolveLocaleSwitchNavigationHref(input: {
  readonly pathname: string;
  readonly nextLocale: string;
  /**
   * Registry `seoIndexingEnabled` for `nextLocale` (selectable rows are already enabled).
   * Prefix navigation is allowed only when this is strictly true.
   */
  readonly seoIndexingEnabled: boolean;
}): string | null {
  const next = input.nextLocale.trim();
  const nextKey = normalizeLanguageRegistryLocaleKey(next);
  const defaultKey = normalizeLanguageRegistryLocaleKey(DEFAULT_PLATFORM_LANGUAGE);
  const parsed = parsePublicSeoLocalePrefixedPath(input.pathname);
  const localeFreePath = parsed?.localeFreePath ?? input.pathname;
  const onSeoDocument =
    parsed != null || isPublicSeoLocalePath(localeFreePath);
  if (!onSeoDocument) {
    return null;
  }
  if (!next || nextKey === defaultKey) {
    return localeFreePath || "/";
  }
  // Fail closed: missing/false SEO flag must never mint a locale-prefixed URL.
  if (input.seoIndexingEnabled !== true) {
    return localeFreePath || "/";
  }
  const segment = toPublicSeoLocaleUrlSegment(next);
  const path = localeFreePath === "/" ? "" : localeFreePath;
  return `/${segment}${path}`;
}
