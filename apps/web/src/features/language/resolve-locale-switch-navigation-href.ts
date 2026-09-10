/**
 * Locale-switch navigation for SEO-prefixed public routes.
 * Pure helper — no React / next-intl dependency.
 *
 * Registry-driven: any future locale string becomes `/{normalizedSegment}{path}`.
 * No finite current-locale route map. English/default platform language uses the
 * locale-free public path (existing canonical routing convention).
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
 * Default platform language uses the locale-free public path (/media).
 * Any other Registry locale uses /{segment}{path} (e.g. /de/media).
 * Non-SEO routes (workspace, etc.) return null — cookie + refresh only.
 */
export function resolveLocaleSwitchNavigationHref(input: {
  readonly pathname: string;
  readonly nextLocale: string;
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
  const segment = toPublicSeoLocaleUrlSegment(next);
  const path = localeFreePath === "/" ? "" : localeFreePath;
  return `/${segment}${path}`;
}
