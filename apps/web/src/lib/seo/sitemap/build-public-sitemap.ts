import type { MetadataRoute } from "next";
import {
  DEFAULT_PLATFORM_LANGUAGE,
  isSeoIndexableLanguage,
  normalizeLanguageRegistryLocaleKey,
  type PublicSeoLocaleRoutingCatalogEntry,
} from "@hu/types";

import { shouldDisallowSearchIndexing } from "../../platform-indexing";
import { countSitemapEntityResolves } from "../../system-health/sitemap-entity-resolve-count";
import {
  closeSitemapBuildObservation,
  emitSitemapBuildDiagnostic,
  openSitemapBuildObservation,
  readCurrentSitemapMemory,
} from "../../system-health/sitemap-build-diagnostic";
import { recordSitemapMemoryBoundary } from "../../system-health/web-memory-sampler";
import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../public-site-url";
import { dedupeSitemapPathEntries } from "./dedupe-sitemap-entries";
import { buildPublicSeoLocalizedVariantPredicate } from "../public-seo-localized-eligibility-loader";
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
 * - Each remote/dynamic provider is isolated: a failure omits that domain only.
 * - The completion diagnostic records the provider id. Exception text is not logged.
 * - Empty results from a successful provider are allowed (honest empty domain).
 */
async function collectProviderEntries(
  providerId: string,
  provider: SitemapProvider,
  failedProviderIds: string[],
): Promise<SitemapPathEntry[]> {
  try {
    const entries = await provider();
    return [...entries];
  } catch {
    failedProviderIds.push(providerId);
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
  /**
   * Page-specific eligibility. Production omits this and loads owner evidence.
   * Explicit `seoIndexableLocales` without this predicate keeps path expansion
   * for mechanics tests.
   */
  readonly isLocalizedVariantEligible?: (
    localeFreePath: string,
    locale: string,
  ) => boolean;
}): Promise<SitemapPathEntry[]> {
  const observation = openSitemapBuildObservation();
  recordSitemapMemoryBoundary("start");
  const failedProviderIds: string[] = [];
  let canonicalPathCount = 0;
  let seoLocaleCount = 0;
  let entityResolveCount = 0;
  let outcome: "completed" | "provider_failure" | "build_failure" = "completed";
  const memoryAtStart = readCurrentSitemapMemory();
  let memoryAfterInventory: ReturnType<typeof readCurrentSitemapMemory> | null = null;
  let memoryAfterEligibility: ReturnType<typeof readCurrentSitemapMemory> | null = null;

  try {
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
        collectProviderEntries("blog-posts", listBlogPostSitemapEntries, failedProviderIds),
        collectProviderEntries("initiatives", listInitiativeSitemapEntries, failedProviderIds),
        collectProviderEntries(
          "knowledge-articles",
          listKnowledgeArticleSitemapEntries,
          failedProviderIds,
        ),
        collectProviderEntries("civic-archive", listCivicArchiveSitemapEntries, failedProviderIds),
        collectProviderEntries(
          "participant-profiles",
          listParticipantProfileSitemapEntries,
          failedProviderIds,
        ),
      ]);
      canonical = dedupeSitemapPathEntries([...localEntries, ...dynamicBatches.flat()]);
    }
    memoryAfterInventory = readCurrentSitemapMemory();

    const explicitLocales = Boolean(
      options && Object.prototype.hasOwnProperty.call(options, "seoIndexableLocales"),
    );
    const seoLocales = explicitLocales
      ? (options?.seoIndexableLocales ?? [])
      : await resolveSeoIndexableLocalesForSitemap();

    let isLocalizedVariantEligible = options?.isLocalizedVariantEligible;
    const loaderWillRun =
      !isLocalizedVariantEligible && !explicitLocales && seoLocales.length > 0;
    if (loaderWillRun) {
      isLocalizedVariantEligible = await buildPublicSeoLocalizedVariantPredicate({
        localeFreePaths: canonical.map((entry) => entry.path),
        locales: seoLocales,
      });
    }
    memoryAfterEligibility = readCurrentSitemapMemory();
    canonicalPathCount = canonical.length;
    seoLocaleCount = seoLocales.length;
    entityResolveCount = loaderWillRun
      ? countSitemapEntityResolves(
          canonical.map((entry) => entry.path),
          seoLocales,
        )
      : 0;
    if (failedProviderIds.length > 0) {
      outcome = "provider_failure";
    }

    return expandPublicSitemapEntriesForSeoLocales({
      entries: canonical,
      seoIndexableLocales: seoLocales,
      defaultLocale: DEFAULT_PLATFORM_LANGUAGE,
      ...(isLocalizedVariantEligible ? { isLocalizedVariantEligible } : {}),
    });
  } catch (error) {
    outcome = "build_failure";
    throw error;
  } finally {
    emitSitemapBuildDiagnostic({
      observation,
      outcome,
      failedProviderIds,
      partialProviderIds: [],
      canonicalPathCount,
      seoLocaleCount,
      entityResolveCount,
      memoryAtStart,
      memoryAfterInventory,
      memoryAfterEligibility,
    });
    closeSitemapBuildObservation();
    recordSitemapMemoryBoundary("completion");
  }
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

function emitShortCircuitSitemapDiagnostic(
  outcome: "indexing_disallowed" | "origin_missing",
): void {
  const observation = openSitemapBuildObservation();
  recordSitemapMemoryBoundary("start");
  try {
    emitSitemapBuildDiagnostic({
      observation,
      outcome,
      failedProviderIds: [],
      partialProviderIds: [],
      canonicalPathCount: 0,
      seoLocaleCount: 0,
      entityResolveCount: 0,
      memoryAtStart: readCurrentSitemapMemory(),
      memoryAfterInventory: null,
      memoryAfterEligibility: null,
    });
  } finally {
    closeSitemapBuildObservation();
    recordSitemapMemoryBoundary("completion");
  }
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
    emitShortCircuitSitemapDiagnostic("indexing_disallowed");
    return [];
  }

  const origin = resolvePublicSiteOrigin();
  if (!origin) {
    emitShortCircuitSitemapDiagnostic("origin_missing");
    return [];
  }

  const entries = await collectPublicSitemapPathEntries({
    ...(options && Object.prototype.hasOwnProperty.call(options, "seoIndexableLocales")
      ? { seoIndexableLocales: options.seoIndexableLocales }
      : {}),
  });
  return toMetadataRouteSitemap(entries, origin);
}
