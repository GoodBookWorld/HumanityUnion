/**
 * Step 07C.2 / Pack 02I successor — active hreflang policy for public SEO documents.
 *
 * Pack 2.1 introduced Registry-gated locale-prefixed public URLs
 * (`/{locale}/…` when enabled && seoIndexingEnabled). Emitting
 * `alternates.languages` + `x-default` is therefore valid for paths inside
 * `PUBLIC_SEO_LOCALE_PATH_PATTERNS`.
 *
 * Invariants:
 * - English/default → locale-free URL (never `/en/...`)
 * - SEO-prefixed document → self-canonical prefixed URL
 * - Hreflang from Registry SEO-indexable locales only (route availability, not CT)
 * - Outside the SEO perimeter → do not emit language alternates
 * - `html[lang]` remains separate (root layout / document locale)
 */

import {
  DEFAULT_PLATFORM_LANGUAGE,
  buildPublicSeoLocaleAlternatePaths,
  isPublicSeoLocalePath,
  resolvePublicSeoDocumentSelfCanonicalPath,
  type PublicSeoLocaleAlternatePaths,
} from "@hu/types";

/** Active emission for perimeter SEO documents (replaces obsolete DEFERRED stub). */
export const HREFLANG_STATUS = "ACTIVE" as const;

/**
 * @deprecated Kept for migration of Pack 02I string assertions — status is ACTIVE.
 * Prefer `HREFLANG_STATUS === "ACTIVE"`.
 */
export const HREFLANG_DEFERRED_REASON =
  "Obsolete: locale-prefixed SEO public URLs exist (Pack 2.1). " +
  "Hreflang emission is ACTIVE for PUBLIC_SEO_LOCALE_PATH_PATTERNS documents.";

/** Emit language alternates when the locale-free entity path is in the SEO perimeter. */
export function shouldEmitHreflangAlternates(localeFreePath: string): boolean {
  return isPublicSeoLocalePath(localeFreePath);
}

/** Emit x-default (locale-free) whenever language alternates are emitted. */
export function shouldEmitXDefault(localeFreePath: string): boolean {
  return shouldEmitHreflangAlternates(localeFreePath);
}

export type ResolvePublicSeoHreflangPathsInput = {
  readonly localeFreePath: string;
  /** Locales already filtered to enabled && seoIndexingEnabled. */
  readonly seoIndexableLocales: readonly string[];
  readonly defaultLocale?: string;
};

/**
 * Policy wrapper around the shared pure alternate-path helper.
 */
export function resolvePublicSeoHreflangPaths(
  input: ResolvePublicSeoHreflangPathsInput,
): PublicSeoLocaleAlternatePaths {
  return buildPublicSeoLocaleAlternatePaths({
    localeFreePath: input.localeFreePath,
    seoIndexableLocales: input.seoIndexableLocales,
    defaultLocale: input.defaultLocale ?? DEFAULT_PLATFORM_LANGUAGE,
  });
}

export type ResolvePublicSeoSelfCanonicalPathInput = {
  readonly localeFreePath: string;
  readonly isLocalePrefixedDocument: boolean;
  readonly documentLocale: string | null | undefined;
  readonly defaultLocale?: string;
};

export function resolvePublicSeoSelfCanonicalPath(
  input: ResolvePublicSeoSelfCanonicalPathInput,
): string {
  return resolvePublicSeoDocumentSelfCanonicalPath({
    localeFreePath: input.localeFreePath,
    isLocalePrefixedDocument: input.isLocalePrefixedDocument,
    documentLocale: input.documentLocale,
    defaultLocale: input.defaultLocale ?? DEFAULT_PLATFORM_LANGUAGE,
  });
}

/**
 * Next.js `alternates.languages` map: language codes + `x-default`.
 * Returns null when alternates must not be emitted.
 */
export function toNextMetadataLanguageAlternates(
  alternates: PublicSeoLocaleAlternatePaths,
  toAbsoluteUrl: (path: string) => string = (path) => path,
): Record<string, string> | null {
  if (!alternates.emitLanguageAlternates) {
    return null;
  }
  const languages: Record<string, string> = {};
  for (const [code, path] of Object.entries(alternates.languagePaths)) {
    languages[code] = toAbsoluteUrl(path);
  }
  languages["x-default"] = toAbsoluteUrl(alternates.xDefaultPath);
  return languages;
}
