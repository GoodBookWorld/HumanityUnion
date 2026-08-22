import type {
  ApprovedNewsSource,
  FactCheckResource,
  MediaResource,
  PropagandaAnalysisResource,
  TrustedMediaCategoryId,
  TrustedMediaResource,
} from "@hu/types";
import { getMediaRegistryProviderById } from "@hu/media-registry";

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export function toTrustedMediaResource(resource: MediaResource): TrustedMediaResource | null {
  if (resource.resourceType !== "TRUSTED_MEDIA" || !resource.active) {
    return null;
  }

  if (!resource.categoryId) {
    return null;
  }

  return {
    id: resource.id,
    name: resource.name,
    logoLabel: resource.logoLabel,
    ...(resource.logoUrl ? { logoUrl: resource.logoUrl } : {}),
    country: resource.secondaryText?.trim() || resource.countryCode || "International",
    ...(resource.countryCode ? { countryCode: resource.countryCode } : {}),
    categoryId: resource.categoryId as TrustedMediaCategoryId,
    explanation: resource.description?.trim() || "",
    websiteUrl: resource.websiteUrl,
    sortOrder: resource.sortOrder,
  };
}

export function toFactCheckResource(resource: MediaResource): FactCheckResource | null {
  if (resource.resourceType !== "FACT_CHECKING" || !resource.active) {
    return null;
  }

  return {
    id: resource.id,
    name: resource.name,
    logoLabel: resource.logoLabel,
    ...(resource.logoUrl ? { logoUrl: resource.logoUrl } : {}),
    mission: resource.description?.trim() || "",
    coverage: resource.secondaryText?.trim() || "",
    websiteUrl: resource.websiteUrl,
    sortOrder: resource.sortOrder,
  };
}

export function toPropagandaAnalysisResource(
  resource: MediaResource,
): PropagandaAnalysisResource | null {
  if (resource.resourceType !== "PROPAGANDA_ANALYSIS" || !resource.active) {
    return null;
  }

  return {
    id: resource.id,
    name: resource.name,
    logoLabel: resource.logoLabel,
    ...(resource.logoUrl ? { logoUrl: resource.logoUrl } : {}),
    focus: resource.description?.trim() || "",
    explanation: resource.secondaryText?.trim() || "",
    websiteUrl: resource.websiteUrl,
    sortOrder: resource.sortOrder,
  };
}

export function toApprovedNewsSource(resource: MediaResource): ApprovedNewsSource | null {
  if (resource.resourceType !== "NEWS_SOURCE" || !resource.active) {
    return null;
  }

  const rssFeedUrl = resource.rssUrl?.trim();
  if (!rssFeedUrl) {
    return null;
  }

  const providerId = resource.providerId?.trim() || resource.id;
  const registryProvider = getMediaRegistryProviderById(providerId);
  const sourceDomain =
    registryProvider?.sourceDomains[0] ?? hostnameFromUrl(resource.websiteUrl);
  const category =
    registryProvider?.categories[0] ??
    registryProvider?.rssFeeds[0]?.defaultCategory ??
    "democracy";

  return {
    providerId,
    sourceName: resource.name,
    sourceDomain,
    rssFeedUrl,
    language: resource.language?.trim() || registryProvider?.language || "en",
    category,
  };
}

export function projectTrustedMediaResources(
  resources: readonly MediaResource[],
): TrustedMediaResource[] {
  return resources
    .map(toTrustedMediaResource)
    .filter((entry): entry is TrustedMediaResource => entry !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function projectFactCheckResources(
  resources: readonly MediaResource[],
): FactCheckResource[] {
  return resources
    .map(toFactCheckResource)
    .filter((entry): entry is FactCheckResource => entry !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function projectPropagandaAnalysisResources(
  resources: readonly MediaResource[],
): PropagandaAnalysisResource[] {
  return resources
    .map(toPropagandaAnalysisResource)
    .filter((entry): entry is PropagandaAnalysisResource => entry !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export function projectApprovedNewsSources(
  resources: readonly MediaResource[],
): ApprovedNewsSource[] {
  return resources
    .map(toApprovedNewsSource)
    .filter((entry): entry is ApprovedNewsSource => entry !== null);
}

export function listActiveNewsSourceRssUrls(
  resources: readonly MediaResource[],
): string[] {
  return resources
    .filter(
      (resource) =>
        resource.resourceType === "NEWS_SOURCE" &&
        resource.active &&
        Boolean(resource.rssUrl?.trim()),
    )
    .map((resource) => resource.rssUrl!.trim());
}
