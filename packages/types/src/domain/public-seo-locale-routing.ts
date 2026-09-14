/**
 * Pack 2.1 — public SEO locale-prefixed routing resolver contract.
 *
 * Pure / deterministic. Reusable by metadata, sitemap, and hreflang packs later.
 * Does not invoke machine translation. Does not invent routes outside the SEO perimeter.
 */

import { DEFAULT_PLATFORM_LANGUAGE } from "./language.js";
import { isSeoIndexableLanguage } from "./language-registry.js";
import {
  normalizeLanguageRegistryLocaleKey,
  type LanguageRegistryId,
  type LanguageRegistryLocale,
  type LanguageTextDirection,
} from "./language-registry.js";
import {
  buildRuntimeLocaleCatalogIndex,
  resolveEnabledCatalogEntryForCandidate,
  resolveRuntimeLocaleFromCatalog,
  type ResolvedRuntimeLocale,
  type ResolveRuntimeLocaleInput,
  type RuntimeLocaleCatalogEntry,
} from "./runtime-locale.js";

/**
 * Catalog row for SEO routing decisions.
 * Public list membership implies enabled; flag is still carried explicitly.
 */
export interface PublicSeoLocaleRoutingCatalogEntry extends RuntimeLocaleCatalogEntry {
  readonly enabled: boolean;
  readonly seoIndexingEnabled: boolean;
}

/** SEO public path after stripping an optional locale prefix (pathname form). */
export const PUBLIC_SEO_LOCALE_PATH_PATTERNS: readonly RegExp[] = [
  /^\/$/,
  /^\/institutions\/?$/,
  /^\/initiatives\/?$/,
  /^\/initiatives\/public\/[^/]+\/?$/,
  /^\/blog\/?$/,
  /^\/blog\/[^/]+\/?$/,
  /^\/media\/?$/,
  /^\/knowledge\/?$/,
  /^\/knowledge\/[^/]+\/?$/,
  /^\/volunteer\/?$/,
  /^\/contact\/?$/,
  /^\/membership\/?$/,
  /^\/privacy\/?$/,
  /^\/terms\/?$/,
];

/** Top-level App Router segments that must never be treated as locale prefixes. */
export const PUBLIC_SEO_LOCALE_RESERVED_TOP_SEGMENTS: ReadonlySet<string> = new Set([
  "about",
  "account",
  "admin",
  "api",
  "blog",
  "civic-accountability",
  "civic-action-packages",
  "civic-activity",
  "civic-archive",
  "collaborative-analysis",
  "collective-decisions",
  "community",
  "confirm-email",
  "confirm-email-change",
  "contact",
  "countries",
  "country",
  "decision-sessions",
  "health",
  "implementation-commitments",
  "implementation-tracking",
  "implementations",
  "improvement-proposals",
  "initiative-analyses",
  "initiative-implementation-commitments",
  "initiatives",
  "institutions",
  "knowledge",
  "login",
  "media",
  "member",
  "membership",
  "notifications",
  "participation",
  "password-reset",
  "petitions",
  "preferences",
  "privacy",
  "profile",
  "public-responses",
  "region",
  "register",
  "search",
  "site-map",
  "support",
  "terms",
  "verify-email",
  "volunteer",
  "workspace",
]);

/** Dynamic SEO slug segments that are not indexable article pages under locale prefix. */
export const PUBLIC_SEO_LOCALE_RESERVED_BLOG_SLUGS: ReadonlySet<string> = new Set([
  "subscribe",
]);

export const PUBLIC_SEO_LOCALE_RESERVED_KNOWLEDGE_SLUGS: ReadonlySet<string> = new Set([
  "media",
]);

export type PublicSeoLocaleDocumentResolution = {
  /** Raw first path segment when the request looks locale-prefixed; else null. */
  readonly urlLocaleSegment: string | null;
  /** Registry-canonical locale when the segment matches a catalog row; else null. */
  readonly normalizedLocale: LanguageRegistryLocale | null;
  readonly languageId: LanguageRegistryId | null;
  readonly textDirection: LanguageTextDirection | null;
  /** Catalog enabled flag (public list membership ⇒ true when matched). */
  readonly enabled: boolean;
  /** `enabled && seoIndexingEnabled` for the matched catalog row. */
  readonly seoIndexable: boolean;
  /**
   * True only when the URL is a locale-prefixed SEO public document that may
   * render as an indexable localized variant.
   */
  readonly isLocalePrefixedDocument: boolean;
  /** Interface locale for this request (URL wins when prefixed document is valid). */
  readonly effectiveLocale: ResolvedRuntimeLocale;
};

function normalizePathname(pathname: string): string {
  if (!pathname || pathname === "") {
    return "/";
  }
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1) || "/";
  }
  return withSlash;
}

/**
 * Whether `pathname` (locale-free form) is inside the Pack 2.1 SEO public perimeter.
 */
export function isPublicSeoLocalePath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);
  if (PUBLIC_SEO_LOCALE_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
    if (/^\/blog\/([^/]+)\/?$/.test(normalized)) {
      const slug = normalized.replace(/^\/blog\//, "").replace(/\/$/, "");
      if (PUBLIC_SEO_LOCALE_RESERVED_BLOG_SLUGS.has(slug)) {
        return false;
      }
    }
    if (/^\/knowledge\/([^/]+)\/?$/.test(normalized)) {
      const slug = normalized.replace(/^\/knowledge\//, "").replace(/\/$/, "");
      if (PUBLIC_SEO_LOCALE_RESERVED_KNOWLEDGE_SLUGS.has(slug)) {
        return false;
      }
    }
    return true;
  }
  return false;
}

/**
 * Parse `/uk/initiatives` → `{ segment: "uk", localeFreePath: "/initiatives" }`.
 * Returns null when the path is not a candidate locale-prefixed SEO URL shape.
 */
export function parsePublicSeoLocalePrefixedPath(pathname: string): {
  readonly segment: string;
  readonly localeFreePath: string;
} | null {
  const normalized = normalizePathname(pathname);
  if (normalized === "/") {
    return null;
  }
  const match = normalized.match(/^\/([^/]+)(\/.*)?$/);
  if (!match) {
    return null;
  }
  const segment = match[1] ?? "";
  if (!segment || PUBLIC_SEO_LOCALE_RESERVED_TOP_SEGMENTS.has(segment.toLowerCase())) {
    return null;
  }
  const rest = match[2] && match[2].length > 0 ? match[2] : "/";
  if (!isPublicSeoLocalePath(rest)) {
    return null;
  }
  return { segment, localeFreePath: normalizePathname(rest) };
}

/**
 * Map a URL locale segment (`zh-hant`) onto a catalog row without collapsing structure.
 */
export function matchPublicSeoLocaleCatalogEntry(
  urlLocaleSegment: string | null | undefined,
  catalog: readonly PublicSeoLocaleRoutingCatalogEntry[],
): PublicSeoLocaleRoutingCatalogEntry | null {
  if (typeof urlLocaleSegment !== "string" || urlLocaleSegment.trim().length === 0) {
    return null;
  }
  const index = buildRuntimeLocaleCatalogIndex(catalog);
  const hit = resolveEnabledCatalogEntryForCandidate(urlLocaleSegment, index);
  if (!hit) {
    return null;
  }
  return (
    catalog.find(
      (row) =>
        normalizeLanguageRegistryLocaleKey(row.locale) ===
        normalizeLanguageRegistryLocaleKey(hit.locale),
    ) ?? null
  );
}

/**
 * Deterministic Pack 2.1 locale document resolver.
 *
 * URL locale segment (when present and SEO-indexable) wins over cookie / Accept-Language.
 * Invalid / non-SEO prefixes do not become indexable localized documents; effective
 * locale then falls back to the existing Pack 02C chain (for safe 404 chrome).
 */
export function resolvePublicSeoLocaleDocument(input: {
  readonly urlLocaleSegment?: string | null;
  readonly catalog: readonly PublicSeoLocaleRoutingCatalogEntry[];
  readonly runtime?: ResolveRuntimeLocaleInput;
}): PublicSeoLocaleDocumentResolution {
  const runtimeInput = input.runtime ?? {};
  const fallbackEffective = resolveRuntimeLocaleFromCatalog(
    runtimeInput,
    input.catalog,
  );

  const segment =
    typeof input.urlLocaleSegment === "string" && input.urlLocaleSegment.trim().length > 0
      ? input.urlLocaleSegment.trim()
      : null;

  if (!segment) {
    return {
      urlLocaleSegment: null,
      normalizedLocale: null,
      languageId: null,
      textDirection: null,
      enabled: false,
      seoIndexable: false,
      isLocalePrefixedDocument: false,
      effectiveLocale: fallbackEffective,
    };
  }

  const matched = matchPublicSeoLocaleCatalogEntry(segment, input.catalog);
  if (!matched) {
    return {
      urlLocaleSegment: segment,
      normalizedLocale: null,
      languageId: null,
      textDirection: null,
      enabled: false,
      seoIndexable: false,
      isLocalePrefixedDocument: false,
      effectiveLocale: fallbackEffective,
    };
  }

  const enabled = matched.enabled === true;
  const seoIndexable = isSeoIndexableLanguage({
    enabled,
    seoIndexingEnabled: matched.seoIndexingEnabled === true,
  });

  if (!seoIndexable) {
    return {
      urlLocaleSegment: segment,
      normalizedLocale: matched.locale,
      languageId: matched.languageId,
      textDirection: matched.textDirection,
      enabled,
      seoIndexable: false,
      isLocalePrefixedDocument: false,
      effectiveLocale: fallbackEffective,
    };
  }

  return {
    urlLocaleSegment: segment,
    normalizedLocale: matched.locale,
    languageId: matched.languageId,
    textDirection: matched.textDirection,
    enabled: true,
    seoIndexable: true,
    isLocalePrefixedDocument: true,
    effectiveLocale: {
      locale: matched.locale,
      languageId: matched.languageId,
      textDirection: matched.textDirection,
      source: "url",
    },
  };
}

/** URL path segment for a Registry locale (`zh-Hant` → `zh-hant`). */
export function toPublicSeoLocaleUrlSegment(locale: string): string {
  return normalizeLanguageRegistryLocaleKey(locale);
}

function normalizeLocaleFreePublicPath(pathname: string): string {
  if (!pathname || pathname === "") {
    return "/";
  }
  const withSlash = pathname.startsWith("/") ? pathname : `/${pathname}`;
  if (withSlash.length > 1 && withSlash.endsWith("/")) {
    return withSlash.slice(0, -1) || "/";
  }
  return withSlash;
}

/**
 * Prefixed public path for a non-default SEO locale (`/media` + `uk` → `/uk/media`).
 * Default/English must never be passed here — callers keep locale-free URLs for `en`.
 */
export function buildPublicSeoLocalePrefixedPath(
  localeFreePath: string,
  locale: string,
): string {
  const free = normalizeLocaleFreePublicPath(localeFreePath);
  const segment = toPublicSeoLocaleUrlSegment(locale);
  if (!segment) {
    return free;
  }
  if (free === "/") {
    return `/${segment}`;
  }
  return `/${segment}${free}`;
}

export type PublicSeoLocaleAlternatePaths = {
  /** Locale-free path used for `x-default` and English/default. */
  readonly xDefaultPath: string;
  /**
   * hreflang language → public path.
   * Includes default locale → locale-free path.
   * Does **not** include `x-default` (returned separately).
   * Never includes `/en/...` prefixed paths.
   */
  readonly languagePaths: Readonly<Record<string, string>>;
  /** False when path is outside the Pack 2.1 SEO perimeter — do not emit languages. */
  readonly emitLanguageAlternates: boolean;
};

/**
 * Step 07C.2 — pure locale-free path + SEO-indexable Registry locales → hreflang paths.
 *
 * Route availability only (no CT). Outside `PUBLIC_SEO_LOCALE_PATH_PATTERNS` → no alternates.
 * Default platform language is always locale-free (never `/en/...`).
 */
export function buildPublicSeoLocaleAlternatePaths(input: {
  readonly localeFreePath: string;
  /** Registry locales already filtered to enabled && seoIndexingEnabled. */
  readonly seoIndexableLocales: readonly string[];
  /** Defaults to platform English (`en`). */
  readonly defaultLocale?: string;
}): PublicSeoLocaleAlternatePaths {
  const localeFreePath = normalizeLocaleFreePublicPath(input.localeFreePath);
  const defaultLocale = normalizeLanguageRegistryLocaleKey(
    input.defaultLocale?.trim() || DEFAULT_PLATFORM_LANGUAGE,
  );

  if (!isPublicSeoLocalePath(localeFreePath)) {
    return {
      xDefaultPath: localeFreePath,
      languagePaths: {},
      emitLanguageAlternates: false,
    };
  }

  const languagePaths: Record<string, string> = {
    [defaultLocale]: localeFreePath,
  };

  for (const raw of input.seoIndexableLocales) {
    const locale = typeof raw === "string" ? raw.trim() : "";
    if (!locale) {
      continue;
    }
    const key = normalizeLanguageRegistryLocaleKey(locale);
    if (!key || key === defaultLocale) {
      continue;
    }
    // Never advertise a default-locale URL segment (e.g. `/en/...`).
    if (toPublicSeoLocaleUrlSegment(locale) === defaultLocale) {
      continue;
    }
    languagePaths[locale.trim()] = buildPublicSeoLocalePrefixedPath(localeFreePath, locale);
  }

  return {
    xDefaultPath: localeFreePath,
    languagePaths,
    emitLanguageAlternates: true,
  };
}

/**
 * Step 07C.2 — self-canonical path for the current SEO document.
 * Prefixed only when the request is a valid SEO-indexable locale document
 * and the entity path is inside the public SEO perimeter.
 */
export function resolvePublicSeoDocumentSelfCanonicalPath(input: {
  readonly localeFreePath: string;
  readonly isLocalePrefixedDocument: boolean;
  readonly documentLocale: string | null | undefined;
  readonly defaultLocale?: string;
}): string {
  const localeFreePath = normalizeLocaleFreePublicPath(input.localeFreePath);
  const defaultKey = normalizeLanguageRegistryLocaleKey(
    input.defaultLocale?.trim() || DEFAULT_PLATFORM_LANGUAGE,
  );

  if (!isPublicSeoLocalePath(localeFreePath)) {
    return localeFreePath;
  }

  if (!input.isLocalePrefixedDocument) {
    return localeFreePath;
  }

  const documentLocale =
    typeof input.documentLocale === "string" ? input.documentLocale.trim() : "";
  if (!documentLocale) {
    return localeFreePath;
  }

  const documentKey = normalizeLanguageRegistryLocaleKey(documentLocale);
  if (!documentKey || documentKey === defaultKey) {
    return localeFreePath;
  }

  return buildPublicSeoLocalePrefixedPath(localeFreePath, documentLocale);
}
