/**
 * Step 07C.2 — request-aware public SEO canonical + hreflang adapter.
 *
 * Resolves self-canonical and language alternates from:
 * - locale-free entity canonical path (caller)
 * - current Pack 2.1 SEO document resolution (request headers / URL)
 * - request-cached public Language Registry catalog
 *
 * No provider / CT / PLP work. Sync `buildPublicPageMetadata` remains the emitter.
 */

import type { Metadata } from "next";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isSeoIndexableLanguage,
  normalizeLanguageRegistryLocaleKey,
  type PublicSeoLocaleRoutingCatalogEntry,
} from "@hu/types";

import {
  listPublicSeoRoutingCatalogForRequest,
  resolvePublicSeoLocaleDocumentForRequest,
} from "../../features/language/resolve-document-locale";
import {
  buildPublicPageMetadata,
  type BuildPublicPageMetadataInput,
} from "./build-public-page-metadata";
import {
  resolvePublicSeoHreflangPaths,
  resolvePublicSeoSelfCanonicalPath,
  toNextMetadataLanguageAlternates,
} from "./hreflang-policy";
import {
  normalizeCanonicalPath,
  resolvePublicSiteOrigin,
  toAbsolutePublicUrl,
} from "./public-site-url";

export type ResolvePublicSeoMetadataDocumentPathsInput = {
  /** Locale-free entity path, e.g. `/initiatives/public/{id}`. */
  readonly localeFreeCanonicalPath: string;
  /** Optional catalog override for tests. */
  readonly catalog?: readonly PublicSeoLocaleRoutingCatalogEntry[];
  /** Optional document overrides for deterministic tests. */
  readonly urlLocaleSegment?: string | null;
  readonly pathname?: string | null;
};

export type ResolvedPublicSeoMetadataDocumentPaths = {
  readonly localeFreePath: string;
  readonly selfCanonicalPath: string;
  /** Null when alternates must not be emitted (outside perimeter / empty / failure). */
  readonly languageAlternates: Readonly<Record<string, string>> | null;
};

function listSeoIndexableLocales(
  catalog: readonly PublicSeoLocaleRoutingCatalogEntry[],
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of catalog) {
    if (
      !isSeoIndexableLanguage({
        enabled: row.enabled === true,
        seoIndexingEnabled: row.seoIndexingEnabled === true,
      })
    ) {
      continue;
    }
    const locale = row.locale.trim();
    const key = normalizeLanguageRegistryLocaleKey(locale);
    if (!locale || !key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(locale);
  }
  return out.sort((a, b) => a.localeCompare(b));
}

/**
 * Derive self-canonical + hreflang paths for the current request.
 */
export async function resolvePublicSeoMetadataDocumentPaths(
  input: ResolvePublicSeoMetadataDocumentPathsInput,
): Promise<ResolvedPublicSeoMetadataDocumentPaths> {
  const localeFreePath = normalizeCanonicalPath(input.localeFreeCanonicalPath);

  try {
    const hasCatalogOverride = Object.prototype.hasOwnProperty.call(input, "catalog");
    const catalog = hasCatalogOverride
      ? (input.catalog ?? [])
      : await listPublicSeoRoutingCatalogForRequest();

    // Explicit empty catalog → no invented alternates; locale-free canonical.
    if (hasCatalogOverride && catalog.length === 0) {
      return {
        localeFreePath,
        selfCanonicalPath: localeFreePath,
        languageAlternates: null,
      };
    }

    const document = await resolvePublicSeoLocaleDocumentForRequest({
      catalog,
      ...(Object.prototype.hasOwnProperty.call(input, "urlLocaleSegment")
        ? { urlLocaleSegment: input.urlLocaleSegment }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(input, "pathname")
        ? { pathname: input.pathname }
        : {}),
    });

    const seoLocales = listSeoIndexableLocales(catalog);

    const selfCanonicalPath = resolvePublicSeoSelfCanonicalPath({
      localeFreePath,
      isLocalePrefixedDocument: document.isLocalePrefixedDocument === true,
      documentLocale: document.normalizedLocale,
      defaultLocale: DEFAULT_PLATFORM_LANGUAGE,
    });

    const hreflang = resolvePublicSeoHreflangPaths({
      localeFreePath,
      seoIndexableLocales: seoLocales,
      defaultLocale: DEFAULT_PLATFORM_LANGUAGE,
    });

    if (!hreflang.emitLanguageAlternates) {
      return {
        localeFreePath,
        selfCanonicalPath,
        languageAlternates: null,
      };
    }

    const origin = resolvePublicSiteOrigin();
    const languageAlternates = toNextMetadataLanguageAlternates(hreflang, (path) =>
      toAbsolutePublicUrl(path, origin),
    );

    return {
      localeFreePath,
      selfCanonicalPath,
      languageAlternates,
    };
  } catch {
    return {
      localeFreePath,
      selfCanonicalPath: localeFreePath,
      languageAlternates: null,
    };
  }
}

/**
 * Async metadata builder: locale-free entity path in, request-aware canonical +
 * hreflang out. Page migrations (07C.3) should prefer this over the sync builder.
 */
export async function buildPublicPageMetadataForRequest(
  input: BuildPublicPageMetadataInput & {
    readonly localeFreeCanonicalPath?: string;
    readonly catalog?: readonly PublicSeoLocaleRoutingCatalogEntry[];
    readonly urlLocaleSegment?: string | null;
    readonly pathname?: string | null;
  },
): Promise<Metadata> {
  const localeFreeCanonicalPath = normalizeCanonicalPath(
    input.localeFreeCanonicalPath ?? input.canonicalPath,
  );

  const resolved = await resolvePublicSeoMetadataDocumentPaths({
    localeFreeCanonicalPath,
    ...(Object.prototype.hasOwnProperty.call(input, "catalog")
      ? { catalog: input.catalog }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "urlLocaleSegment")
      ? { urlLocaleSegment: input.urlLocaleSegment }
      : {}),
    ...(Object.prototype.hasOwnProperty.call(input, "pathname")
      ? { pathname: input.pathname }
      : {}),
  });

  return buildPublicPageMetadata({
    ...input,
    canonicalPath: resolved.selfCanonicalPath,
    languageAlternates: resolved.languageAlternates,
  });
}
