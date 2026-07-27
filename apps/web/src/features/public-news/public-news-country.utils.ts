import type { MediaRegistryRegionTag, PublicNewsArticleItem } from "@hu/types";
import {
  filterMediaRegistryProviders,
  getMediaRegistryProviderByName,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "@hu/media-registry";

export interface CountryPublicNewsMediaRef {
  id: string;
  name: string;
}

export interface CountryPublicNewsContext {
  countryCode: string;
  countryName: string;
  regionName?: string;
  language?: string;
  recommendedMedia?: CountryPublicNewsMediaRef[];
  topics?: string[];
}

export interface CountryPublicNewsFilterResult {
  articles: PublicNewsArticleItem[];
  usedFallback: boolean;
}

const GLOBAL_REGION_TAGS: MediaRegistryRegionTag[] = ["global", "international"];

function normalizeMatchValue(value: string): string {
  return value.trim().toLowerCase();
}

export function mapGeographyRegionToRegistryTag(
  regionName: string | undefined,
): MediaRegistryRegionTag | undefined {
  if (!regionName) {
    return undefined;
  }

  const normalized = normalizeMatchValue(regionName);

  if (normalized.includes("europe")) {
    return "europe";
  }

  if (normalized.includes("america")) {
    return "americas";
  }

  if (normalized.includes("africa")) {
    return "africa";
  }

  if (normalized.includes("asia") || normalized.includes("oceania")) {
    return "asia-pacific";
  }

  if (normalized.includes("middle east")) {
    return "middle-east";
  }

  return "international";
}

function addProviderNames(target: Set<string>, providerName: string, aliases?: string[]): void {
  target.add(providerName);

  for (const alias of aliases ?? []) {
    target.add(alias);
  }
}

export function buildCountryPreferredSourceNames(context: CountryPublicNewsContext): Set<string> {
  const names = new Set<string>();
  const normalizedCountryCode = context.countryCode.trim().toUpperCase();
  const normalizedCountryName = normalizeMatchValue(context.countryName);
  const language = normalizeMatchValue(context.language ?? "en");

  for (const media of context.recommendedMedia ?? []) {
    names.add(media.name);
  }

  for (const provider of TRUSTED_GLOBAL_MEDIA_REGISTRY) {
    const matchesCountryCode = provider.countryCode?.toUpperCase() === normalizedCountryCode;
    const matchesCountryName = normalizeMatchValue(provider.country) === normalizedCountryName;

    if (matchesCountryCode || matchesCountryName) {
      addProviderNames(names, provider.name, provider.aliases);
    }
  }

  const registryMatches = filterMediaRegistryProviders(TRUSTED_GLOBAL_MEDIA_REGISTRY, {
    country: context.countryName,
    language,
    region: mapGeographyRegionToRegistryTag(context.regionName),
  });

  for (const provider of registryMatches) {
    addProviderNames(names, provider.name, provider.aliases);
  }

  return names;
}

function articleMatchesSourceName(
  article: PublicNewsArticleItem,
  preferredSourceNames: Set<string>,
): boolean {
  if (preferredSourceNames.has(article.sourceName)) {
    return true;
  }

  const provider = getMediaRegistryProviderByName(article.sourceName);

  if (!provider) {
    return false;
  }

  return preferredSourceNames.has(provider.name) || (provider.aliases?.some((alias) => preferredSourceNames.has(alias)) ?? false);
}

function articleMatchesTopics(article: PublicNewsArticleItem, topics: string[] | undefined): boolean {
  if (!topics || topics.length === 0) {
    return true;
  }

  const category = normalizeMatchValue(article.category ?? "");

  return topics.some((topic) => category === normalizeMatchValue(topic));
}

function filterArticlesByCountryProviders(
  articles: PublicNewsArticleItem[],
  context: CountryPublicNewsContext,
  preferredSourceNames: Set<string>,
): PublicNewsArticleItem[] {
  return articles.filter(
    (article) =>
      articleMatchesSourceName(article, preferredSourceNames) &&
      articleMatchesTopics(article, context.topics),
  );
}

function filterArticlesByGlobalFallback(
  articles: PublicNewsArticleItem[],
  context: CountryPublicNewsContext,
): PublicNewsArticleItem[] {
  const regionTag = mapGeographyRegionToRegistryTag(context.regionName);
  const language = normalizeMatchValue(context.language ?? "en");

  return articles.filter((article) => {
    if (!articleMatchesTopics(article, context.topics)) {
      return false;
    }

    const provider = getMediaRegistryProviderByName(article.sourceName);

    if (!provider) {
      return false;
    }

    if (normalizeMatchValue(provider.language) !== language) {
      return false;
    }

    const hasGlobalScope = provider.regionTags.some((tag) => GLOBAL_REGION_TAGS.includes(tag));

    if (!hasGlobalScope) {
      return false;
    }

    if (!regionTag) {
      return true;
    }

    return provider.regionTags.includes(regionTag) || provider.regionTags.includes("international");
  });
}

export function filterPublicNewsForCountry(
  articles: PublicNewsArticleItem[],
  context: CountryPublicNewsContext,
): CountryPublicNewsFilterResult {
  const preferredSourceNames = buildCountryPreferredSourceNames(context);
  const countryArticles = filterArticlesByCountryProviders(articles, context, preferredSourceNames);

  if (countryArticles.length > 0) {
    return {
      articles: countryArticles,
      usedFallback: false,
    };
  }

  return {
    articles: filterArticlesByGlobalFallback(articles, context),
    usedFallback: true,
  };
}
