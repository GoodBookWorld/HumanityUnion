import type { MetadataRoute } from "next";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isSeoIndexableLanguage,
  normalizeLanguageRegistryLocaleKey,
  type PublicSeoLocaleRoutingCatalogEntry,
} from "@hu/types";

import { shouldDisallowSearchIndexing } from "../../platform-indexing";
import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../public-site-url";
import { dedupeSitemapPathEntries } from "./dedupe-sitemap-entries";
import { expandPublicSitemapEntriesForSeoLocales } from "./expand-public-sitemap-for-seo-locales";
import { listBlogPostSitemapEntries } from "./providers/blog-posts";
import { listCivicArchiveSitemapEntries } from "./providers/civic-archive";
import { listCountrySitemapEntries } from "./providers/countries";
import { listInitiativeSitemapEntries } from "./providers/initiatives";
import { listKnowledgeArticleSitemapEntries } from "./providers/knowledge-articles";
import { listParticipantProfileSitemapEntries } from "./providers/participant-profiles";
import { listStaticPublicSitemapEntries } from "./providers/static-public-pages";
import type { SitemapPathEntry, SitemapProvider } from "./types";

export class SitemapProviderError extends Error {
  readonly providerId: string;

  constructor(providerId: string, cause: unknown) {
    const message = cause instanceof Error ? cause.message : String(cause);
    super(`Sitemap provider "${providerId}" failed: ${message}`);
    this.name = "SitemapProviderError";
    this.providerId = providerId;
  }
}

/**
 * Failure-isolation policy (Pack 02):
 * - Static + Country providers are local and always collected first.
 * - Each remote/dynamic provider is isolated: a failure omits that domain only
 *   and is reported via console.error (no fabricated private URLs).
 * - Empty results from a successful provider are allowed (honest empty domain).
 */
async function collectProviderEntries(
  providerId: string,
  provider: SitemapProvider,
): Promise<SitemapPathEntry[]> {
  try {
    const entries = await provider();
    return [...entries];
  } catch (error) {
    const wrapped = new SitemapProviderError(providerId, error);
    console.error(wrapped.message);
    return [];
  }
}

function listSeoIndexableLocalesFromCatalog(
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
 * Step 07E — one Registry catalog read per sitemap build (request-cached when
 * available). Failures yield [] so expansion is skipped (canonical-only).
 */
async function resolveSeoIndexableLocalesForSitemap(): Promise<readonly string[]> {
  try {
    const { listPublicSeoRoutingCatalogForRequest } = await import(
      "../../../features/language/resolve-document-locale"
    );
    const catalog = await listPublicSeoRoutingCatalogForRequest();
    return listSeoIndexableLocalesFromCatalog(catalog);
  } catch {
    return [];
  }
}

export async function collectPublicSitemapPathEntries(options?: {
  includeDynamicProviders?: boolean;
  /**
   * Step 07E — SEO-indexable Registry locales for expansion.
   * - omitted / undefined → fetch public Registry once (fail → no expansion)
   * - [] → canonical locale-free only
   * - provided list → use as-is (tests / overrides)
   */
  readonly seoIndexableLocales?: readonly string[];
}): Promise<SitemapPathEntry[]> {
  const includeDynamic = options?.includeDynamicProviders !== false;

  const localEntries: SitemapPathEntry[] = [
    ...listStaticPublicSitemapEntries(),
    ...listCountrySitemapEntries(),
  ];

  let canonical: SitemapPathEntry[];
  if (!includeDynamic) {
    canonical = dedupeSitemapPathEntries(localEntries);
  } else {
    const dynamicBatches = await Promise.all([
      collectProviderEntries("blog-posts", listBlogPostSitemapEntries),
      collectProviderEntries("initiatives", listInitiativeSitemapEntries),
      collectProviderEntries("knowledge-articles", listKnowledgeArticleSitemapEntries),
      collectProviderEntries("civic-archive", listCivicArchiveSitemapEntries),
      collectProviderEntries("participant-profiles", listParticipantProfileSitemapEntries),
    ]);
    canonical = dedupeSitemapPathEntries([...localEntries, ...dynamicBatches.flat()]);
  }

  const seoLocales =
    options && Object.prototype.hasOwnProperty.call(options, "seoIndexableLocales")
      ? (options.seoIndexableLocales ?? [])
      : await resolveSeoIndexableLocalesForSitemap();

  return expandPublicSitemapEntriesForSeoLocales({
    entries: canonical,
    seoIndexableLocales: seoLocales,
    defaultLocale: DEFAULT_PLATFORM_LANGUAGE,
  });
}

export function toMetadataRouteSitemap(
  entries: readonly SitemapPathEntry[],
  origin: string = resolvePublicSiteOrigin(),
): MetadataRoute.Sitemap {
  if (!origin) {
    return [];
  }

  return entries.map((entry) => {
    const url = toAbsolutePublicUrl(entry.path, origin);
    return {
      url,
      ...(entry.lastModified !== undefined
        ? { lastModified: entry.lastModified }
        : {}),
    };
  });
}

/**
 * Build the production sitemap inventory.
 *
 * When indexing is disallowed, returns [] so staging/dev never advertise a
 * crawl inventory. When NEXT_PUBLIC_SITE_URL is unset, returns [] so Next.js
 * cannot absolutize paths against an arbitrary request Host.
 *
 * Step 07E — after canonical collection, expands PUBLIC_SEO_LOCALE_PATH_PATTERNS
 * entries for Registry enabled+seoIndexingEnabled locales (never `/en/...`).
 */
export async function buildPublicSitemap(options?: {
  readonly seoIndexableLocales?: readonly string[];
}): Promise<MetadataRoute.Sitemap> {
  if (shouldDisallowSearchIndexing()) {
    return [];
  }

  const origin = resolvePublicSiteOrigin();
  if (!origin) {
    return [];
  }

  const entries = await collectPublicSitemapPathEntries({
    ...(options && Object.prototype.hasOwnProperty.call(options, "seoIndexableLocales")
      ? { seoIndexableLocales: options.seoIndexableLocales }
      : {}),
  });
  return toMetadataRouteSitemap(entries, origin);
}
