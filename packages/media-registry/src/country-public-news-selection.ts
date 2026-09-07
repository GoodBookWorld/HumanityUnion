/**
 * RESET 05D — shared country public-news rail selection.
 *
 * Product contract:
 * 1. Select country-relevant articles FIRST (preferred/recommended sources,
 *    registry country match, geographicScope match).
 * 2. Only AFTER that set is chosen, supplement with global/international
 *    fallback to fill the rail limit.
 * 3. Never apply global EN+balance truncation before country relevance —
 *    callers must pass a candidate corpus large enough that country sources
 *    are present (see COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT).
 *
 * Used by: live country consumer, PLP auto-build coverage, diagnostics.
 */

import type { MediaRegistryRegionTag } from "@hu/types";
import {
  getMediaRegistryProviderByName,
  TRUSTED_GLOBAL_MEDIA_REGISTRY,
} from "./media-registry.js";
import { filterMediaRegistryProviders } from "./media-registry.filters.js";

/** Bound for candidate corpus before country-first selection (not the rail size). */
export const COUNTRY_PUBLIC_NEWS_CANDIDATE_LIMIT = 120;

/** Country / discovery rail presentation bound. */
export const COUNTRY_PUBLIC_NEWS_RAIL_LIMIT = 24;

export type CountryNewsSelectableArticle = {
  readonly id: string;
  readonly sourceName: string;
  readonly category?: string | null;
  readonly publishedAt: string;
  readonly geographicScope?: string | null;
};

export type CountryPublicNewsMediaRef = {
  readonly id: string;
  readonly name: string;
};

export type CountryPublicNewsContext = {
  readonly countryCode: string;
  readonly countryName: string;
  readonly regionName?: string;
  readonly language?: string;
  readonly recommendedMedia?: readonly CountryPublicNewsMediaRef[];
  readonly topics?: readonly string[];
};

export type CountryPublicNewsSelectionResult<T extends CountryNewsSelectableArticle> = {
  readonly articles: readonly T[];
  readonly countryRelevant: readonly T[];
  readonly supplemented: readonly T[];
  readonly usedFallback: boolean;
  /** Country-relevant ids present in candidates but dropped only by rail cap (not truncation). */
  readonly countryRelevantExcludedByCap: number;
};

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

/** Shared source-identity key (case/space insensitive) for News ↔ affiliated matching. */
export function normalizeMediaSourceIdentity(value: string): string {
  return normalizeMatchValue(value);
}

function addProviderNames(target: Set<string>, providerName: string, aliases?: string[]): void {
  target.add(normalizeMediaSourceIdentity(providerName));
  for (const alias of aliases ?? []) {
    target.add(normalizeMediaSourceIdentity(alias));
  }
}

export function buildCountryPreferredSourceNames(context: CountryPublicNewsContext): Set<string> {
  const names = new Set<string>();
  const normalizedCountryCode = context.countryCode.trim().toUpperCase();
  const normalizedCountryName = normalizeMatchValue(context.countryName);
  const language = normalizeMatchValue(context.language ?? "en");

  for (const media of context.recommendedMedia ?? []) {
    addProviderNames(names, media.name);
    const registered = getMediaRegistryProviderByName(media.name);
    if (registered) {
      addProviderNames(names, registered.name, registered.aliases);
    }
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

export function articleMatchesPreferredSourceName(
  article: CountryNewsSelectableArticle,
  preferredSourceNames: Set<string>,
): boolean {
  if (preferredSourceNames.has(normalizeMediaSourceIdentity(article.sourceName))) {
    return true;
  }
  const provider = getMediaRegistryProviderByName(article.sourceName);
  if (!provider) {
    return false;
  }
  return (
    preferredSourceNames.has(normalizeMediaSourceIdentity(provider.name)) ||
    (provider.aliases?.some((alias) =>
      preferredSourceNames.has(normalizeMediaSourceIdentity(alias)),
    ) ??
      false)
  );
}

function articleMatchesSourceName(
  article: CountryNewsSelectableArticle,
  preferredSourceNames: Set<string>,
): boolean {
  return articleMatchesPreferredSourceName(article, preferredSourceNames);
}

/** Step 1 — article originates from configured country-affiliated sources (not body text). */
export function isCountryAffiliatedSourceArticle(
  article: CountryNewsSelectableArticle,
  context: CountryPublicNewsContext,
  preferredSourceNames: Set<string> = buildCountryPreferredSourceNames(context),
): boolean {
  return articleMatchesPreferredSourceName(article, preferredSourceNames);
}

function articleMatchesTopics(
  article: CountryNewsSelectableArticle,
  topics: readonly string[] | undefined,
): boolean {
  if (!topics || topics.length === 0) {
    return true;
  }
  const category = normalizeMatchValue(article.category ?? "");
  return topics.some((topic) => category === normalizeMatchValue(topic));
}

function articleMatchesGeographicScope(
  article: CountryNewsSelectableArticle,
  context: CountryPublicNewsContext,
): boolean {
  const scope = normalizeMatchValue(article.geographicScope ?? "");
  if (!scope || scope === "global" || scope === "international") {
    return false;
  }
  const code = normalizeMatchValue(context.countryCode);
  const name = normalizeMatchValue(context.countryName);
  return scope === code || scope.includes(name) || scope.includes(code);
}

export function isCountryRelevantArticle(
  article: CountryNewsSelectableArticle,
  context: CountryPublicNewsContext,
  preferredSourceNames: Set<string> = buildCountryPreferredSourceNames(context),
): boolean {
  if (!articleMatchesTopics(article, context.topics)) {
    return false;
  }
  return (
    articleMatchesSourceName(article, preferredSourceNames) ||
    articleMatchesGeographicScope(article, context)
  );
}

function sortNewestFirst<T extends CountryNewsSelectableArticle>(articles: readonly T[]): T[] {
  return [...articles].sort((a, b) => {
    const byDate = Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
    if (byDate !== 0) {
      return byDate;
    }
    return a.id.localeCompare(b.id);
  });
}

function filterArticlesByGlobalFallback<T extends CountryNewsSelectableArticle>(
  articles: readonly T[],
  context: CountryPublicNewsContext,
): T[] {
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

/**
 * Country-first rail selection. Global supplementation happens only after
 * country-relevant articles are chosen — never instead of them via upstream truncate.
 */
export function selectCountryPublicNewsRail<T extends CountryNewsSelectableArticle>(
  candidates: readonly T[],
  context: CountryPublicNewsContext,
  limit: number = COUNTRY_PUBLIC_NEWS_RAIL_LIMIT,
): CountryPublicNewsSelectionResult<T> {
  const preferredSourceNames = buildCountryPreferredSourceNames(context);
  const countryRelevant = sortNewestFirst(
    candidates.filter((article) =>
      isCountryRelevantArticle(article, context, preferredSourceNames),
    ),
  );

  const countrySelected = countryRelevant.slice(0, limit);
  const countryRelevantExcludedByCap = Math.max(0, countryRelevant.length - countrySelected.length);

  if (countrySelected.length >= limit) {
    return {
      articles: countrySelected,
      countryRelevant: countrySelected,
      supplemented: [],
      usedFallback: false,
      countryRelevantExcludedByCap,
    };
  }

  const selectedIds = new Set(countrySelected.map((article) => article.id));
  const remainder = candidates.filter((article) => !selectedIds.has(article.id));
  const fallbackPool = filterArticlesByGlobalFallback(remainder, context);
  const supplementSource =
    fallbackPool.length > 0 ? fallbackPool : sortNewestFirst(remainder);
  const supplemented = sortNewestFirst(supplementSource).slice(
    0,
    limit - countrySelected.length,
  );

  return {
    articles: [...countrySelected, ...supplemented],
    countryRelevant: countrySelected,
    supplemented,
    usedFallback: countrySelected.length === 0,
    countryRelevantExcludedByCap,
  };
}

/**
 * Legacy filter shape (preferred-only, no geographicScope, no supplementation).
 * Prefer selectCountryPublicNewsRail for product-correct rails.
 */
export function filterPublicNewsForCountry<T extends CountryNewsSelectableArticle>(
  articles: readonly T[],
  context: CountryPublicNewsContext,
): { articles: T[]; usedFallback: boolean } {
  const result = selectCountryPublicNewsRail(articles, context, articles.length || COUNTRY_PUBLIC_NEWS_RAIL_LIMIT);
  // Preserve prior "preferred empty → global fallback only" semantics when
  // caller passes an already-truncated pool and expects filter-only behavior.
  if (result.countryRelevant.length > 0) {
    return {
      articles: [...result.countryRelevant],
      usedFallback: false,
    };
  }
  return {
    articles: [...filterArticlesByGlobalFallback(articles, context)],
    usedFallback: true,
  };
}
