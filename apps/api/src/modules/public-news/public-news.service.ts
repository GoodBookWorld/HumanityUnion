import type {
  InitiativeNewsSourceReference,
  NewsArticleRecord,
  PublicNewsListingResponse,
} from "@hu/types";

import { resolvePublicNewsConfig } from "./public-news.config.js";
import type { ExternalNewsArticle } from "./public-news.normalize.js";
import { filterExternalNewsArticles, validateExternalNewsArticleUrls } from "./public-news.filter.js";
import {
  normalizeExternalNewsArticle,
  toInitiativeNewsSourceSnapshot,
  toPublicNewsArticleItem,
} from "./public-news.normalize.js";
import {
  deleteExpiredPublicNewsRecords,
  findActivePublicNewsRecords,
  findActivePublicNewsSourceNames,
  findPublicNewsRecordById,
  markExpiredPublicNewsRecords,
  markPlaceholderPublicNewsRecordsExpired,
  upsertPublicNewsRecords,
} from "./public-news.repository.js";
import { resolveNewsProvider } from "./providers/resolve-news-provider.js";

let refreshInProgress = false;

export interface PublicNewsQuery {
  limit: number;
  language?: string;
  category?: string;
  source?: string;
}

export function parsePublicNewsQuery(query: Record<string, unknown>): PublicNewsQuery {
  const rawLimit = Number.parseInt(String(query.limit ?? "6"), 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 50) : 6;

  const language =
    typeof query.language === "string" && query.language.trim() ? query.language.trim() : undefined;
  const category =
    typeof query.category === "string" && query.category.trim() ? query.category.trim() : undefined;
  const source =
    typeof query.source === "string" && query.source.trim() ? query.source.trim() : undefined;

  return { limit, language, category, source };
}

export async function listPublicNewsArticles(
  query: PublicNewsQuery,
): Promise<PublicNewsListingResponse> {
  const config = resolvePublicNewsConfig();
  const records = await findActivePublicNewsRecords({
    limit: query.limit,
    language: query.language ?? config.defaultLanguage,
    category: query.category,
    source: query.source,
  });
  const activeProviders = await findActivePublicNewsSourceNames({
    language: query.language ?? config.defaultLanguage,
  });

  return {
    items: records.map(toPublicNewsArticleItem),
    generatedAt: new Date().toISOString(),
    retentionDays: config.retentionDays,
    activeProviders,
  };
}

export async function getPublicNewsArticleById(id: string): Promise<NewsArticleRecord | null> {
  const record = await findPublicNewsRecordById(id);

  if (!record) {
    return null;
  }

  if (record.status !== "active" || record.expiresAt <= new Date().toISOString()) {
    return null;
  }

  return record;
}

export async function buildInitiativeNewsSourceSnapshot(
  sourceNewsId: string,
): Promise<InitiativeNewsSourceReference> {
  const record = await findPublicNewsRecordById(sourceNewsId);

  if (!record) {
    throw new Error("News article not found.");
  }

  return toInitiativeNewsSourceSnapshot(record);
}

export async function refreshPublicNews(): Promise<{ upserted: number; fetched: number }> {
  if (refreshInProgress) {
    return { upserted: 0, fetched: 0 };
  }

  refreshInProgress = true;

  try {
    const config = resolvePublicNewsConfig();
    await markExpiredPublicNewsRecords();
    await markPlaceholderPublicNewsRecordsExpired();

    if (!config.enabled) {
      return { upserted: 0, fetched: 0 };
    }

    const provider = resolveNewsProvider();

    if (!provider) {
      return { upserted: 0, fetched: 0 };
    }

    let fetchedArticles: ExternalNewsArticle[] = [];

    try {
      fetchedArticles = await provider.fetchRecentArticles({
        language: config.defaultLanguage,
        limit: config.fetchLimit,
      });
    } catch (error) {
      console.error(
        "[public-news] Provider fetch failed:",
        error instanceof Error ? error.message : error,
      );
      return { upserted: 0, fetched: 0 };
    }

    const filtered = filterExternalNewsArticles(fetchedArticles, {
      retentionDays: config.retentionDays,
    });

    const validated = await validateExternalNewsArticleUrls(filtered);

    const normalized = validated
      .map((article) => {
        try {
          return normalizeExternalNewsArticle(article, config.retentionDays);
        } catch {
          return null;
        }
      })
      .filter((record): record is NewsArticleRecord => record !== null);

    const upserted = await upsertPublicNewsRecords(normalized);

    return {
      upserted,
      fetched: fetchedArticles.length,
    };
  } finally {
    refreshInProgress = false;
  }
}

export async function cleanupExpiredPublicNews(): Promise<{ marked: number; deleted: number }> {
  const marked = await markExpiredPublicNewsRecords();
  const deleted = await deleteExpiredPublicNewsRecords();
  return { marked, deleted };
}

export function seedPublicNewsRecordForTests(record: NewsArticleRecord): void {
  void upsertPublicNewsRecords([record]);
}
