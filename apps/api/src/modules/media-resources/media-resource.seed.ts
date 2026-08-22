import type { MediaResource } from "@hu/types";
import {
  deriveApprovedNewsSources,
  listEnabledMediaRegistryProviders,
} from "@hu/media-registry";

import { FACT_CHECK_RESOURCES } from "../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../civic-media-center/content/propaganda-analysis.js";
import { TRUSTED_MEDIA_RESOURCES } from "../civic-media-center/content/trusted-media.js";
import {
  getMediaResourceById,
  upsertMediaResource,
} from "./persistence/media-resource.repository.js";

const SEED_TIMESTAMP = "2026-06-27T00:00:00.000Z";

function buildTrustedMediaSeeds(): MediaResource[] {
  return TRUSTED_MEDIA_RESOURCES.map((resource) => {
    const hasCountry = Boolean(resource.countryCode?.trim());
    return {
      id: resource.id,
      resourceType: "TRUSTED_MEDIA" as const,
      scopeType: hasCountry ? ("COUNTRY" as const) : ("WORLD" as const),
      countryCode: hasCountry ? resource.countryCode!.toUpperCase() : null,
      name: resource.name,
      logoLabel: resource.logoLabel,
      logoUrl: resource.logoUrl ?? null,
      websiteUrl: resource.websiteUrl,
      categoryId: resource.categoryId,
      description: resource.explanation,
      secondaryText: resource.country,
      active: true,
      sortOrder: resource.sortOrder,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  });
}

function buildFactCheckSeeds(): MediaResource[] {
  return FACT_CHECK_RESOURCES.map((resource) => ({
    id: resource.id,
    resourceType: "FACT_CHECKING" as const,
    scopeType: "WORLD" as const,
    countryCode: null,
    name: resource.name,
    logoLabel: resource.logoLabel,
    logoUrl: resource.logoUrl ?? null,
    websiteUrl: resource.websiteUrl,
    description: resource.mission,
    secondaryText: resource.coverage,
    active: true,
    sortOrder: resource.sortOrder,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));
}

function buildPropagandaSeeds(): MediaResource[] {
  return PROPAGANDA_ANALYSIS_RESOURCES.map((resource) => ({
    id: resource.id,
    resourceType: "PROPAGANDA_ANALYSIS" as const,
    scopeType: "WORLD" as const,
    countryCode: null,
    name: resource.name,
    logoLabel: resource.logoLabel,
    logoUrl: resource.logoUrl ?? null,
    websiteUrl: resource.websiteUrl,
    description: resource.focus,
    secondaryText: resource.explanation,
    active: true,
    sortOrder: resource.sortOrder,
    createdAt: SEED_TIMESTAMP,
    updatedAt: SEED_TIMESTAMP,
  }));
}

function buildNewsSourceSeeds(): MediaResource[] {
  const providers = listEnabledMediaRegistryProviders();
  const derived = deriveApprovedNewsSources(providers);
  const firstFeedByProvider = new Map<string, string>();

  for (const source of derived) {
    if (!firstFeedByProvider.has(source.providerId)) {
      firstFeedByProvider.set(source.providerId, source.rssFeedUrl);
    }
  }

  return providers.map((provider, index) => {
    const hasCountry = Boolean(provider.countryCode?.trim());
    return {
      id: provider.id,
      resourceType: "NEWS_SOURCE" as const,
      scopeType: hasCountry ? ("COUNTRY" as const) : ("WORLD" as const),
      countryCode: hasCountry ? provider.countryCode!.toUpperCase() : null,
      name: provider.name,
      logoLabel: provider.logoLabel,
      logoUrl: provider.logoUrl ?? null,
      websiteUrl: provider.website,
      rssUrl: firstFeedByProvider.get(provider.id) ?? provider.rssFeeds[0]?.url ?? null,
      secondaryText: provider.country,
      language: provider.language,
      providerId: provider.id,
      active: provider.rssEnabled !== false,
      sortOrder: provider.priority ?? index + 1,
      createdAt: SEED_TIMESTAMP,
      updatedAt: SEED_TIMESTAMP,
    };
  });
}

export function buildMediaResourceSeedRecords(): MediaResource[] {
  return [
    ...buildTrustedMediaSeeds(),
    ...buildFactCheckSeeds(),
    ...buildPropagandaSeeds(),
    ...buildNewsSourceSeeds(),
  ];
}

/**
 * Idempotent upsert by id. Preserves createdAt when a record already exists;
 * re-applies canonical seed field values on each run.
 */
export async function seedMediaResourcesFromCanonicalSources(): Promise<number> {
  const seeds = buildMediaResourceSeedRecords();
  let upserted = 0;

  for (const seed of seeds) {
    const existing = await getMediaResourceById(seed.id);
    const record: MediaResource = existing
      ? { ...seed, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
      : seed;

    await upsertMediaResource(record);
    upserted += 1;
  }

  return upserted;
}
