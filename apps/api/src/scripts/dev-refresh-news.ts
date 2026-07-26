import type { NewsArticleRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../infrastructure/mongodb/mongo-database.js";
import { resolvePublicNewsConfig } from "../modules/public-news/public-news.config.js";
import { filterExternalNewsArticles, validateExternalNewsArticleUrls } from "../modules/public-news/public-news.filter.js";
import {
  normalizeExternalNewsArticle,
  type ExternalNewsArticle,
} from "../modules/public-news/public-news.normalize.js";
import { resolveNewsProvider } from "../modules/public-news/providers/resolve-news-provider.js";
import {
  markExpiredPublicNewsRecords,
  markPlaceholderPublicNewsRecordsExpired,
  resolvePublicNewsPersistenceMode,
} from "../modules/public-news/public-news.repository.js";
import { withPublicNewsScriptMongo } from "./dev-public-news-script-lifecycle.js";

interface DevRefreshStats {
  fetched: number;
  accepted: number;
  inserted: number;
  updated: number;
}

async function upsertPublicNewsRecordsWithStats(
  records: NewsArticleRecord[],
): Promise<{ inserted: number; updated: number }> {
  if (records.length === 0) {
    return { inserted: 0, updated: 0 };
  }

  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    const { upsertPublicNewsRecords, findActivePublicNewsRecords } = await import(
      "../modules/public-news/public-news.repository.js"
    );
    const existingUrls = new Set(
      (await findActivePublicNewsRecords({ limit: 1000 })).map(
        (record) => record.normalizedArticleUrl,
      ),
    );

    let inserted = 0;
    let updated = 0;

    for (const record of records) {
      if (existingUrls.has(record.normalizedArticleUrl)) {
        updated += 1;
      } else {
        inserted += 1;
      }
    }

    await upsertPublicNewsRecords(records);
    return { inserted, updated };
  }

  const collection = getMongoCollection<NewsArticleRecord>(MONGO_COLLECTIONS.publicNewsArticles);
  let inserted = 0;
  let updated = 0;

  for (const record of records) {
    const { id, createdAt, ...mutableFields } = record;
    const result = await collection.updateOne(
      { normalizedArticleUrl: record.normalizedArticleUrl },
      {
        $setOnInsert: {
          id,
          createdAt,
        },
        $set: {
          ...mutableFields,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );

    if (result.upsertedCount > 0) {
      inserted += 1;
    } else if (result.modifiedCount > 0) {
      updated += 1;
    }
  }

  return { inserted, updated };
}

async function runDevRefreshPublicNews(): Promise<DevRefreshStats> {
  const config = resolvePublicNewsConfig();
  await markExpiredPublicNewsRecords();
  await markPlaceholderPublicNewsRecordsExpired();

  if (!config.enabled) {
    return { fetched: 0, accepted: 0, inserted: 0, updated: 0 };
  }

  const provider = resolveNewsProvider();

  if (!provider) {
    return { fetched: 0, accepted: 0, inserted: 0, updated: 0 };
  }

  let fetchedArticles: ExternalNewsArticle[] = [];

  try {
    fetchedArticles = await provider.fetchRecentArticles({
      language: config.defaultLanguage,
      limit: config.fetchLimit,
    });
  } catch (error) {
    console.error(
      "[dev:refresh-news] Provider fetch failed:",
      error instanceof Error ? error.message : error,
    );
    return { fetched: 0, accepted: 0, inserted: 0, updated: 0 };
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

  const { inserted, updated } = await upsertPublicNewsRecordsWithStats(normalized);

  return {
    fetched: fetchedArticles.length,
    accepted: normalized.length,
    inserted,
    updated,
  };
}

async function main(): Promise<void> {
  const stats = await withPublicNewsScriptMongo(runDevRefreshPublicNews);

  console.log(
    `[dev:refresh-news] fetched=${stats.fetched} accepted=${stats.accepted} inserted=${stats.inserted} updated=${stats.updated}`,
  );
}

void main()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
