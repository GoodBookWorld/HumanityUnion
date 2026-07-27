import type { PublicNewsArticleItem } from "@hu/types";
import { getMediaRegistryProviderByName } from "@hu/media-registry";

export type PublicNewsSortMode = "newest" | "most-discussed" | "most-relevant";

export interface PublicNewsFilters {
  search: string;
  provider: string;
  topic: string;
  country: string;
  sort: PublicNewsSortMode;
}

export const DEFAULT_PUBLIC_NEWS_FILTERS: PublicNewsFilters = {
  search: "",
  provider: "all",
  topic: "all",
  country: "all",
  sort: "newest",
};

export const PUBLIC_NEWS_PAGE_SIZE = 12;
export const PUBLIC_NEWS_RAIL_LIMIT = 24;

export function resolveProviderPresentation(sourceName: string) {
  const provider = getMediaRegistryProviderByName(sourceName);

  if (provider) {
    return {
      logoUrl: provider.logoUrl,
      logoLabel: provider.logoLabel,
      country: provider.country,
    };
  }

  return {
    logoUrl: undefined,
    logoLabel: sourceName.slice(0, 2).toUpperCase(),
    country: "International",
  };
}

export function formatNewsRelativeTime(isoDate: string): string {
  const parsed = Date.parse(isoDate);

  if (Number.isNaN(parsed)) {
    return isoDate;
  }

  const diffMs = Date.now() - parsed;
  const diffMinutes = Math.round(diffMs / 60_000);

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(parsed));
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase();
}

function relevanceScore(article: PublicNewsArticleItem, search: string): number {
  if (!search) {
    return 0;
  }

  const haystack = `${article.title} ${article.summary} ${article.sourceName} ${article.category ?? ""}`.toLowerCase();
  let score = 0;

  if (article.title.toLowerCase().includes(search)) {
    score += 4;
  }

  if (article.summary.toLowerCase().includes(search)) {
    score += 2;
  }

  if (article.sourceName.toLowerCase().includes(search)) {
    score += 1;
  }

  if (article.category?.toLowerCase().includes(search)) {
    score += 1;
  }

  return haystack.includes(search) ? score : 0;
}

export function filterPublicNewsArticles(
  articles: PublicNewsArticleItem[],
  filters: PublicNewsFilters,
): PublicNewsArticleItem[] {
  const search = normalizeSearch(filters.search);

  return articles.filter((article) => {
    const providerMeta = resolveProviderPresentation(article.sourceName);

    if (filters.provider !== "all" && article.sourceName !== filters.provider) {
      return false;
    }

    if (filters.topic !== "all" && (article.category ?? "General") !== filters.topic) {
      return false;
    }

    if (filters.country !== "all" && providerMeta.country !== filters.country) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = `${article.title} ${article.summary} ${article.sourceName}`.toLowerCase();
    return haystack.includes(search);
  });
}

export function sortPublicNewsArticles(
  articles: PublicNewsArticleItem[],
  sort: PublicNewsSortMode,
  search: string,
): PublicNewsArticleItem[] {
  const sorted = [...articles];
  const normalizedSearch = normalizeSearch(search);

  sorted.sort((left, right) => {
    if (sort === "most-relevant" && normalizedSearch) {
      return relevanceScore(right, normalizedSearch) - relevanceScore(left, normalizedSearch);
    }

    if (sort === "most-discussed") {
      const leftWeight = left.summary.length + left.title.length;
      const rightWeight = right.summary.length + right.title.length;

      if (rightWeight !== leftWeight) {
        return rightWeight - leftWeight;
      }
    }

    return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  });

  return sorted;
}

export function paginatePublicNewsArticles<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

export function collectFilterOptions(
  articles: PublicNewsArticleItem[],
  activeProviders: string[] = [],
) {
  const providers = new Set(activeProviders);
  const topics = new Set<string>();
  const countries = new Set<string>();

  for (const article of articles) {
    providers.add(article.sourceName);
    topics.add(article.category ?? "General");

    countries.add(resolveProviderPresentation(article.sourceName).country);
  }

  return {
    providers: [...providers].sort(),
    topics: [...topics].sort(),
    countries: [...countries].sort(),
  };
}

export function buildDiscussHref(title: string): string {
  return `/search?q=${encodeURIComponent(title)}&entityType=initiative`;
}
