import type { ApprovedNewsSource } from "@hu/types";
import {
  deriveApprovedNewsSources,
  listEnabledMediaRegistryProviders,
  MEDIA_REGISTRY_CATEGORIES,
  resolveMediaRegistryConfig,
} from "@hu/media-registry";

export type { ApprovedNewsSource };

export const APPROVED_NEWS_SOURCES: readonly ApprovedNewsSource[] = deriveApprovedNewsSources();

export const PUBLIC_NEWS_CATEGORIES = MEDIA_REGISTRY_CATEGORIES;

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
    fetchTimeoutMs: 10_000,
    maxResponseBytes: 2 * 1024 * 1024,
  };
}

export function listActiveApprovedNewsSources(
  language: string = resolveMediaRegistryConfig().defaultLanguage,
): ApprovedNewsSource[] {
  const registryConfig = resolveMediaRegistryConfig();
  const normalizedLanguage = language.trim().toLowerCase();

  return APPROVED_NEWS_SOURCES.filter((source) => {
    if (source.language.toLowerCase() !== normalizedLanguage) {
      return false;
    }

    const provider = listEnabledMediaRegistryProviders().find((entry) => entry.id === source.providerId);

    if (!provider) {
      return false;
    }

    return provider.reliabilityScore >= registryConfig.minReliabilityScore;
  });
}
