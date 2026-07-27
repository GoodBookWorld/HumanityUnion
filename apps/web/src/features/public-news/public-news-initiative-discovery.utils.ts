import type { CivicSearchResult, PublicNewsArticleItem } from "@hu/types";

import { fetchPublicSearch } from "../global-search/api";
import { buildCreateInitiativeFromNewsHref, buildRegisterCreateInitiativeFromNewsHref } from "./api";
import { buildDiscussHref } from "./public-news-discovery.utils";

const RELATED_INITIATIVES_CACHE = new Map<string, CivicSearchResult[]>();

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function buildRelatedInitiativesQuery(article: PublicNewsArticleItem): string {
  const titleWords = article.title
    .split(/\s+/)
    .map((word) => word.replace(/[^\w'-]/g, ""))
    .filter((word) => word.length > 3)
    .slice(0, 6);

  if (titleWords.length > 0) {
    return titleWords.join(" ");
  }

  return normalizeWhitespace(article.title).slice(0, 80);
}

export function buildNewsAiSummaryBullets(title: string, summary: string): string[] {
  const normalizedSummary = normalizeWhitespace(summary);
  const sentences = normalizedSummary
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24);

  if (sentences.length > 0) {
    return sentences.slice(0, 3);
  }

  if (normalizedSummary) {
    return [normalizedSummary].slice(0, 3);
  }

  return title ? [`Civic relevance: ${normalizeWhitespace(title)}`] : [];
}

export function buildNewsBookmarkStorageKey(): string {
  return "hu-public-news-bookmarks";
}

export function readNewsBookmarkIds(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(buildNewsBookmarkStorageKey());
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((value) => typeof value === "string") : [];
  } catch {
    return [];
  }
}

export function writeNewsBookmarkIds(ids: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(buildNewsBookmarkStorageKey(), JSON.stringify(ids));
}

export function buildNewsSupportHref(
  article: PublicNewsArticleItem,
  relatedInitiativeId?: string,
): string {
  if (relatedInitiativeId) {
    return `/initiatives/public/${encodeURIComponent(relatedInitiativeId)}`;
  }

  return `/search?q=${encodeURIComponent(article.title)}&entityType=initiative`;
}

export function buildNewsVolunteerHref(article: PublicNewsArticleItem): string {
  return `/search?q=${encodeURIComponent(article.title)}&entityType=implementation_commitment`;
}

export function buildNewsCreateProposalHref(article: PublicNewsArticleItem): string {
  return `/search?q=${encodeURIComponent(article.title)}&entityType=improvement_proposal`;
}

export function buildNewsCreatePetitionHref(article: PublicNewsArticleItem): string {
  return `/search?q=${encodeURIComponent(article.title)}&entityType=petition`;
}

export function buildNewsSharePayload(article: PublicNewsArticleItem) {
  return {
    title: article.title,
    text: `${article.title} — ${article.sourceName}`,
    url: article.articleUrl,
  };
}

export function buildNewsDiscoveryActionHrefs(article: PublicNewsArticleItem) {
  return {
    readOriginal: article.articleUrl,
    createInitiative: buildCreateInitiativeFromNewsHref(article.id),
    registerCreateInitiative: buildRegisterCreateInitiativeFromNewsHref(article.id),
    discuss: buildDiscussHref(article.title),
  };
}

export async function fetchRelatedInitiativesForArticle(
  article: PublicNewsArticleItem,
  limit = 3,
): Promise<CivicSearchResult[]> {
  const query = buildRelatedInitiativesQuery(article);
  const cacheKey = `${query}:${limit}`;

  if (RELATED_INITIATIVES_CACHE.has(cacheKey)) {
    return RELATED_INITIATIVES_CACHE.get(cacheKey) ?? [];
  }

  try {
    const response = await fetchPublicSearch({
      q: query,
      entityType: "initiative",
      limit,
      view: "flat",
    });

    const results = response.results.filter((result) => result.entityType === "initiative");
    RELATED_INITIATIVES_CACHE.set(cacheKey, results);
    return results;
  } catch {
    RELATED_INITIATIVES_CACHE.set(cacheKey, []);
    return [];
  }
}
