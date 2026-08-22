import type { ApprovedNewsSource } from "@hu/types";
import {
  deriveApprovedNewsSources,
  isApprovedMediaRegistryFeedUrl,
  listEnabledMediaRegistryProviders,
  MEDIA_REGISTRY_CATEGORIES,
  resolveMediaRegistryConfig,
} from "@hu/media-registry";

export type { ApprovedNewsSource };

export const APPROVED_NEWS_SOURCES: readonly ApprovedNewsSource[] = deriveApprovedNewsSources();

export const PUBLIC_NEWS_CATEGORIES = MEDIA_REGISTRY_CATEGORIES;

/** Runtime cache populated from MediaResource NEWS_SOURCE after seed/admin mutations. */
let approvedNewsSourcesFromMediaResources: ApprovedNewsSource[] = [];

export interface PublicNewsRuntimeConfig {
  enabled: boolean;
  providerName: string;
  apiKey: string;
  fetchLimit: number;
  retentionDays: number;
  refreshIntervalHours: number;
  defaultLanguage: string;
  fetchTimeoutMs: number;
  maxResponseBytes: number;
}

function parsePositiveInt(value: string | undefined, fallback: number, max?: number): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  if (max !== undefined) {
    return Math.min(parsed, max);
  }

  return parsed;
}

function parsePositiveFloat(value: string | undefined, fallback: number): number {
  const parsed = Number.parseFloat(value ?? "");

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export function resolvePublicNewsConfig(): PublicNewsRuntimeConfig {
  const registryConfig = resolveMediaRegistryConfig();

  return {
    enabled: process.env.NEWS_PROVIDER_ENABLED === "true",
    providerName: (process.env.NEWS_PROVIDER_NAME ?? "rss").trim().toLowerCase(),
    apiKey: (process.env.NEWS_PROVIDER_API_KEY ?? "").trim(),
    fetchLimit: parsePositiveInt(process.env.NEWS_FETCH_LIMIT, 60, 100),
    retentionDays: parsePositiveInt(process.env.NEWS_RETENTION_DAYS, 7, 30),
    refreshIntervalHours: parsePositiveFloat(process.env.NEWS_REFRESH_INTERVAL_HOURS, 6),
    defaultLanguage: registryConfig.defaultLanguage,
    fetchTimeoutMs: parsePositiveInt(process.env.NEWS_FETCH_TIMEOUT_MS, 15_000, 30_000),
    maxResponseBytes: 2 * 1024 * 1024,
  };
}

function normalizeComparableUrl(value: string): string | undefined {
  try {
    const parsed = new URL(value.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "").toLowerCase();
  } catch {
    return undefined;
  }
}

function filterSourcesByLanguage(
  sources: readonly ApprovedNewsSource[],
  language: string,
): ApprovedNewsSource[] {
  const registryConfig = resolveMediaRegistryConfig();
  const normalizedLanguage = language.trim().toLowerCase();

  return sources.filter((source) => {
    if (source.language.toLowerCase() !== normalizedLanguage) {
      return false;
    }

    const provider = listEnabledMediaRegistryProviders().find(
      (entry) => entry.id === source.providerId,
    );

    // Custom admin NEWS_SOURCE entries may not exist in the static registry.
    if (!provider) {
      return true;
    }

    return provider.reliabilityScore >= registryConfig.minReliabilityScore;
  });
}

export async function refreshApprovedNewsSourcesFromMediaResources(): Promise<void> {
  const { listMediaResources } = await import(
    "../media-resources/persistence/media-resource.repository.js"
  );
  const { projectApprovedNewsSources } = await import(
    "../media-resources/media-resource.projections.js"
  );

  const resources = await listMediaResources({
    resourceType: "NEWS_SOURCE",
    active: true,
  });
  approvedNewsSourcesFromMediaResources = projectApprovedNewsSources(resources);
}

export function resetApprovedNewsSourcesCacheForTests(): void {
  approvedNewsSourcesFromMediaResources = [];
}

export function listActiveApprovedNewsSources(
  language: string = resolveMediaRegistryConfig().defaultLanguage,
): ApprovedNewsSource[] {
  if (approvedNewsSourcesFromMediaResources.length > 0) {
    return filterSourcesByLanguage(approvedNewsSourcesFromMediaResources, language);
  }

  return filterSourcesByLanguage(APPROVED_NEWS_SOURCES, language);
}

/**
 * Allow-list check: active MediaResource NEWS_SOURCE rssUrl OR registry feed allow-list.
 */
export function isApprovedNewsFeedUrl(feedUrl: string): boolean {
  if (isApprovedMediaRegistryFeedUrl(feedUrl)) {
    return true;
  }

  const normalized = normalizeComparableUrl(feedUrl);
  if (!normalized) {
    return false;
  }

  return approvedNewsSourcesFromMediaResources.some((source) => {
    const sourceNormalized = normalizeComparableUrl(source.rssFeedUrl);
    return sourceNormalized === normalized;
  });
}
