import type { MediaResource } from "@hu/types";
import {
  deriveApprovedNewsSources,
  listEnabledMediaRegistryProviders,
} from "@hu/media-registry";

import { FACT_CHECK_RESOURCES } from "../civic-media-center/content/fact-checking.js";
import { PROPAGANDA_ANALYSIS_RESOURCES } from "../civic-media-center/content/propaganda-analysis.js";
import { TRUSTED_MEDIA_RESOURCES } from "../civic-media-center/content/trusted-media.js";
import { getMediaResourceTombstone } from "./persistence/media-resource-tombstone.repository.js";
import {
  deleteMediaResource,
  insertMediaResourceIfAbsent,
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
 * Inserts canonical defaults only when (resourceType, id) is absent and has
 * not been hard-deleted. Existing rows are never replaced, reactivated, or
 * timestamped. A NEWS_SOURCE seed never replaces a TRUSTED_MEDIA row.
 * Startup does not schedule civic_media translation or trusted PLP work.
 */
export async function seedMediaResourcesFromCanonicalSources(): Promise<number> {
  const seeds = buildMediaResourceSeedRecords();
  let inserted = 0;

  for (const seed of seeds) {
    const identity = { resourceType: seed.resourceType, id: seed.id };
    if (await getMediaResourceTombstone(identity)) continue;

    const outcome = await insertMediaResourceIfAbsent(seed);
    if (outcome !== "inserted") continue;

    if (await getMediaResourceTombstone(identity)) {
      await deleteMediaResource(identity);
      continue;
    }
    inserted += 1;
  }

  return inserted;
}
