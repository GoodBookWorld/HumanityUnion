import type { MetadataRoute } from "next";

import { shouldDisallowSearchIndexing } from "../../platform-indexing";
import { resolvePublicSiteOrigin, toAbsolutePublicUrl } from "../public-site-url";
import { dedupeSitemapPathEntries } from "./dedupe-sitemap-entries";
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

export async function collectPublicSitemapPathEntries(options?: {
  includeDynamicProviders?: boolean;
}): Promise<SitemapPathEntry[]> {
  const includeDynamic = options?.includeDynamicProviders !== false;

  const localEntries: SitemapPathEntry[] = [
    ...listStaticPublicSitemapEntries(),
    ...listCountrySitemapEntries(),
  ];

  if (!includeDynamic) {
    return dedupeSitemapPathEntries(localEntries);
  }

  const dynamicBatches = await Promise.all([
    collectProviderEntries("blog-posts", listBlogPostSitemapEntries),
    collectProviderEntries("initiatives", listInitiativeSitemapEntries),
    collectProviderEntries("knowledge-articles", listKnowledgeArticleSitemapEntries),
    collectProviderEntries("civic-archive", listCivicArchiveSitemapEntries),
    collectProviderEntries("participant-profiles", listParticipantProfileSitemapEntries),
  ]);

  return dedupeSitemapPathEntries([...localEntries, ...dynamicBatches.flat()]);
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
 */
export async function buildPublicSitemap(): Promise<MetadataRoute.Sitemap> {
  if (shouldDisallowSearchIndexing()) {
    return [];
  }

  const origin = resolvePublicSiteOrigin();
  if (!origin) {
    return [];
  }

  const entries = await collectPublicSitemapPathEntries();
  return toMetadataRouteSitemap(entries, origin);
}
