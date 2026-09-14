/**
 * Pack 2.1A / 2.1B — SEO locale request helpers (no Next imports).
 *
 * Pathname/segment recovery + request-scoped `hu_lang` Cookie rewrite for proxy.
 */

import {
  HU_LANG_COOKIE_NAME,
  isSeoIndexableLanguage,
  normalizeLanguageRegistryLocaleKey,
  parsePublicSeoLocalePrefixedPath,
} from "@hu/types";

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

/**
 * Normalize a URL locale segment to platform Registry casing (`zh-hant` → `zh-Hant`).
 * When a catalog canonical locale is already known, prefer that instead.
 */
export function normalizeSeoLocaleUrlSegmentToPlatformLocale(segment: string): string {
  const trimmed = segment.trim();
  if (!trimmed) {
    return trimmed;
  }
  const key = normalizeLanguageRegistryLocaleKey(trimmed);
  if (key === "zh-hant" || key === "zh-tw" || key === "zh-hk") {
    return "zh-Hant";
  }
  return trimmed;
}

/**
 * Pack 2.1B — rewrite only `hu_lang` in a Cookie request header.
 * Preserves unrelated cookies; does not emit Set-Cookie.
 */
export function rewriteRequestCookieHeaderHuLang(
  cookieHeader: string | null | undefined,
  huLangValue: string,
): string {
  const value = huLangValue.trim();
  const assignment = `${HU_LANG_COOKIE_NAME}=${value}`;

  if (typeof cookieHeader !== "string" || cookieHeader.trim().length === 0) {
    return assignment;
  }

  const huLangPair = new RegExp(
    `(^|;\\s*)${HU_LANG_COOKIE_NAME}=[^;]*`,
    "i",
  );
  if (huLangPair.test(cookieHeader)) {
    return cookieHeader.replace(huLangPair, `$1${assignment}`);
  }

  const trimmedEnd = cookieHeader.replace(/\s+$/, "");
  if (trimmedEnd.endsWith(";")) {
    return `${trimmedEnd} ${assignment}`;
  }
  return `${trimmedEnd}; ${assignment}`;
}

/** Registry row shape for proxy SEO authority (includes explicit `enabled`). */
export type SeoProxyRegistryLocaleRow = {
  readonly locale: string;
  readonly aliases: readonly string[];
  readonly enabled: boolean;
  readonly seoIndexingEnabled: boolean;
};

export type SeoProxyCookieAuthorityDecision =
  | {
      readonly applyOverride: true;
      readonly locale: string;
    }
  | {
      readonly applyOverride: false;
      readonly reason:
        | "registry_unavailable"
        | "locale_absent"
        | "not_seo_indexable";
    };

/**
 * Pack 2.1B — decide request-scoped hu_lang override from Registry rows.
 * Fail closed when catalog is null/unavailable or locale is absent / not SEO-indexable.
 * Uses shared `isSeoIndexableLanguage` (enabled && seoIndexingEnabled).
 */
export function decideSeoProxyCookieAuthority(input: {
  readonly urlLocaleSegment: string;
  /** null = Registry fetch failed / malformed. */
  readonly catalog: readonly SeoProxyRegistryLocaleRow[] | null;
}): SeoProxyCookieAuthorityDecision {
  if (input.catalog === null) {
    return { applyOverride: false, reason: "registry_unavailable" };
  }

  const want = normalizeLanguageRegistryLocaleKey(input.urlLocaleSegment);
  if (!want) {
    return { applyOverride: false, reason: "locale_absent" };
  }

  let matched: SeoProxyRegistryLocaleRow | null = null;
  for (const row of input.catalog) {
    const localeKey = normalizeLanguageRegistryLocaleKey(row.locale);
    if (localeKey === want) {
      matched = row;
      break;
    }
    if (
      row.aliases.some(
        (alias) => normalizeLanguageRegistryLocaleKey(alias) === want,
      )
    ) {
      matched = row;
      break;
    }
  }

  if (!matched) {
    return { applyOverride: false, reason: "locale_absent" };
  }

  if (
    !isSeoIndexableLanguage({
      enabled: matched.enabled === true,
      seoIndexingEnabled: matched.seoIndexingEnabled === true,
    })
  ) {
    return { applyOverride: false, reason: "not_seo_indexable" };
  }

  return { applyOverride: true, locale: matched.locale };
}
