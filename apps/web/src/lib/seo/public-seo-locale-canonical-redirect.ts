/**
 * Universal noncanonical locale-segment redirect.
 *
 * Recognized Registry locales and aliases normalize to the canonical SEO URL
 * segment (`toPublicSeoLocaleUrlSegment`). English stays locale-free.
 * Unknown or reserved first segments are not locale routes.
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  buildPublicSeoLocalePrefixedPath,
  normalizeLanguageRegistryLocaleKey,
  parsePublicSeoLocalePrefixedPath,
  toPublicSeoLocaleUrlSegment,
} from "@hu/types";

export type PublicSeoLocaleIdentityRow = {
  readonly locale: string;
  readonly aliases?: readonly string[];
};

function matchLocaleRow(
  segment: string,
  catalog: readonly PublicSeoLocaleIdentityRow[],
): PublicSeoLocaleIdentityRow | null {
  const want = normalizeLanguageRegistryLocaleKey(segment);
  if (!want) {
    return null;
  }
  for (const row of catalog) {
    if (normalizeLanguageRegistryLocaleKey(row.locale) === want) {
      return row;
    }
    if (
      (row.aliases ?? []).some(
        (alias) => normalizeLanguageRegistryLocaleKey(alias) === want,
      )
    ) {
      return row;
    }
  }
  return null;
}

/**
 * Returns the canonical pathname when the request used a recognized but
 * noncanonical locale segment. Returns null when no redirect is required.
 * `catalog === null` (Registry unavailable) does not invent a redirect.
 */
export function resolveCanonicalPublicSeoLocalePathname(input: {
  readonly pathname: string;
  readonly catalog: readonly PublicSeoLocaleIdentityRow[] | null;
}): string | null {
  if (!input.catalog) {
    return null;
  }

  const parsed = parsePublicSeoLocalePrefixedPath(input.pathname);
  if (!parsed) {
    return null;
  }

  const matched = matchLocaleRow(parsed.segment, input.catalog);
  if (!matched) {
    return null;
  }

  const localeKey = normalizeLanguageRegistryLocaleKey(matched.locale);
  const defaultKey = normalizeLanguageRegistryLocaleKey(DEFAULT_PLATFORM_LANGUAGE);
  const target =
    localeKey === defaultKey
      ? parsed.localeFreePath
      : buildPublicSeoLocalePrefixedPath(parsed.localeFreePath, matched.locale);

  const current = parsePublicSeoLocalePrefixedPath(input.pathname);
  const currentPath = current
    ? `/${current.segment}${current.localeFreePath === "/" ? "" : current.localeFreePath}`
    : input.pathname;

  if (target === currentPath || target === input.pathname) {
    return null;
  }
  return target;
}
