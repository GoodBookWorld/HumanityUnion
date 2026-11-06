import type { NewsArticleRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";
import { isMongoConfigured } from "../../infrastructure/mongodb/mongo-config.js";

import { isPlaceholderArticleUrl } from "./public-news.fetch.js";
import { isMediaRegistryWebsiteUrl, isSpecificMediaArticleUrl, getMediaRegistryProviderByName } from "@hu/media-registry";

const memoryRecords = new Map<string, NewsArticleRecord>();

export type PublicNewsPersistenceMode = "memory" | "mongodb";

export function resolvePublicNewsPersistenceMode(): PublicNewsPersistenceMode {
  const configured = process.env.PUBLIC_NEWS_PERSISTENCE?.trim().toLowerCase();

  if (configured === "memory") {
    return "memory";
  }

  if (configured === "mongodb") {
    return "mongodb";
  }

  if (isMongoConfigured() && process.env.HU_VERIFICATION_MODE !== "true") {
    return "mongodb";
  }

  return "memory";
}

function getCollection() {
  return getMongoCollection<NewsArticleRecord>(MONGO_COLLECTIONS.publicNewsArticles);
}

export function resetPublicNewsMemoryStoreForTests(): void {
  memoryRecords.clear();
}

export async function upsertPublicNewsRecords(records: NewsArticleRecord[]): Promise<number> {
  if (records.length === 0) {
    return 0;
  }

  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    for (const record of records) {
      const existing = [...memoryRecords.values()].find(
        (candidate) => candidate.normalizedArticleUrl === record.normalizedArticleUrl,
      );

      if (existing) {
        memoryRecords.set(existing.id, {
          ...existing,
          ...record,
          imageUrl: record.imageUrl ?? existing.imageUrl,
          id: existing.id,
          createdAt: existing.createdAt,
          updatedAt: new Date().toISOString(),
        });
      } else {
        memoryRecords.set(record.id, structuredClone(record));
      }
    }

    return records.length;
  }

  const collection = getCollection();
  let upserted = 0;

  for (const record of records) {
    const { id, createdAt, imageUrl, ...otherFields } = record;
    // A feed item that temporarily omits its image must not erase the stored one
    // (the driver would otherwise write `undefined` as null).
    const mutableFields = imageUrl ? { ...otherFields, imageUrl } : otherFields;
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

    if (result.upsertedCount > 0 || result.modifiedCount > 0) {
      upserted += 1;
    }
  }

  return upserted;
}

function sortNewestFirst(records: NewsArticleRecord[]): NewsArticleRecord[] {
  return [...records].sort(
    (left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt),
  );
}

/**
 * Prevent one prolific source from consuming the entire public news rail.
 * Round-robin across sources (newest article first within each source), then
 * present the mixed result newest-first.
 */
export function balancePublicNewsRecordsBySource(
  records: NewsArticleRecord[],
  limit: number,
): NewsArticleRecord[] {
  if (limit <= 0) {
    return [];
  }

  if (records.length <= limit) {
    return sortNewestFirst(records);
  }

  const bySource = new Map<string, NewsArticleRecord[]>();

  for (const record of sortNewestFirst(records)) {
    const bucket = bySource.get(record.sourceName);

    if (bucket) {
      bucket.push(record);
    } else {
      bySource.set(record.sourceName, [record]);
    }
  }

  const sources = [...bySource.keys()].sort((left, right) => {
    const leftNewest = bySource.get(left)?.[0]?.publishedAt ?? "";
    const rightNewest = bySource.get(right)?.[0]?.publishedAt ?? "";
    return Date.parse(rightNewest) - Date.parse(leftNewest);
  });

  const selected: NewsArticleRecord[] = [];
  const offsets = new Map<string, number>(sources.map((source) => [source, 0]));
  let madeProgress = true;

  while (selected.length < limit && madeProgress) {
    madeProgress = false;

    for (const source of sources) {
      if (selected.length >= limit) {
        break;
      }

      const bucket = bySource.get(source) ?? [];
      const offset = offsets.get(source) ?? 0;

      if (offset < bucket.length) {
        selected.push(bucket[offset]!);
        offsets.set(source, offset + 1);
        madeProgress = true;
      }
    }
  }

  return sortNewestFirst(selected).slice(0, limit);
}

export async function findActivePublicNewsRecords(input: {
  limit: number;
  language?: string;
  category?: string;
  source?: string;
  /** Exact `sourceName` matches; applied before the limit, newest first, no source balancing. */
  sources?: readonly string[];
  /**
   * Exact `mediaResourceId` matches, combined with `sources` as a union, so a renamed
   * source keeps its newer articles while older articles still match by name.
   */
  sourceIds?: readonly string[];
  now?: string;
}): Promise<NewsArticleRecord[]> {
  const now = input.now ?? new Date().toISOString();
  const mode = resolvePublicNewsPersistenceMode();
  const exactSources = input.sources || input.sourceIds ? new Set(input.sources ?? []) : null;
  const exactIds = new Set(input.sourceIds ?? []);
  const sourceFilterActive = Boolean(input.source?.trim()) || exactSources !== null;

  if (exactSources !== null && exactSources.size === 0 && exactIds.size === 0) {
    return [];
  }

  if (mode === "memory") {
    const filtered = [...memoryRecords.values()]
      .filter((record) => record.status === "active" && record.expiresAt > now)
      .filter((record) => (input.language ? record.language === input.language : true))
      .filter((record) =>
        input.category ? record.category?.toLowerCase() === input.category.toLowerCase() : true,
      )
      .filter((record) =>
        input.source ? record.sourceName.toLowerCase().includes(input.source.toLowerCase()) : true,
      )
      .filter((record) =>
        exactSources
          ? exactSources.has(record.sourceName) ||
            (record.mediaResourceId !== undefined && exactIds.has(record.mediaResourceId))
          : true,
      );

    if (sourceFilterActive) {
      return sortNewestFirst(filtered).slice(0, input.limit);
    }

    return balancePublicNewsRecordsBySource(filtered, input.limit);
  }

  const query: Record<string, unknown> = {
    status: "active",
    expiresAt: { $gt: now },
  };

  if (input.language) {
    query.language = input.language;
  }

  if (input.category) {
    query.category = input.category;
  }

  if (input.source) {
    query.sourceName = { $regex: input.source, $options: "i" };
  }

  if (exactSources) {
    const byName = { sourceName: { $in: [...exactSources] } };
    const exact =
      exactIds.size > 0 ? { $or: [byName, { mediaResourceId: { $in: [...exactIds] } }] } : byName;
    if (query.sourceName) {
      query.$and = [exact];
    } else {
      Object.assign(query, exact);
    }
  }

  const collection = getCollection();

  if (sourceFilterActive) {
    return collection
      .find(query)
      .sort({ publishedAt: -1 })
      .limit(input.limit)
      .toArray();
  }

  // Pull a bounded newest slice per source, then merge newest-first so older but
  // still-active Pack sources (e.g. Economist) are not erased by prolific feeds.
  const sourceNames = await collection.distinct("sourceName", query);
  const perSourceCap = Math.max(2, Math.ceil(input.limit / Math.max(sourceNames.length, 1)));
  const batches = await Promise.all(
    sourceNames.map((sourceName) =>
      collection
        .find({ ...query, sourceName })
        .sort({ publishedAt: -1 })
        .limit(perSourceCap)
        .toArray(),
    ),
  );

  return balancePublicNewsRecordsBySource(batches.flat(), input.limit);
}

export async function findActivePublicNewsSourceNames(input?: {
  language?: string;
  now?: string;
}): Promise<string[]> {
  const now = input?.now ?? new Date().toISOString();
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    const names = new Set<string>();

    for (const record of memoryRecords.values()) {
      if (record.status !== "active" || record.expiresAt <= now) {
        continue;
      }

      if (input?.language && record.language !== input.language) {
        continue;
      }

      names.add(record.sourceName);
    }

    return [...names].sort();
  }

  const query: Record<string, unknown> = {
    status: "active",
    expiresAt: { $gt: now },
  };

  if (input?.language) {
    query.language = input.language;
  }

  const collection = getCollection();
  const values = await collection.distinct("sourceName", query);

  return values
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .sort();
}

export async function findPublicNewsRecordById(id: string): Promise<NewsArticleRecord | null> {
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    const record = memoryRecords.get(id);
    return record ? structuredClone(record) : null;
  }

  const collection = getCollection();
  const record = await collection.findOne({ id });
  return record ?? null;
}

function shouldExpireStoredArticleUrl(articleUrl: string, sourceName: string): boolean {
  if (isPlaceholderArticleUrl(articleUrl) || isMediaRegistryWebsiteUrl(articleUrl)) {
    return true;
  }

  const provider = getMediaRegistryProviderByName(sourceName);
  return !isSpecificMediaArticleUrl(articleUrl, provider);
}

export async function markPlaceholderPublicNewsRecordsExpired(
  now = new Date().toISOString(),
): Promise<number> {
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    let updated = 0;

    for (const [id, record] of memoryRecords.entries()) {
      if (record.status !== "active") {
        continue;
      }

      if (!shouldExpireStoredArticleUrl(record.articleUrl, record.sourceName)) {
        continue;
      }

      memoryRecords.set(id, {
        ...record,
        status: "expired",
        updatedAt: now,
      });
      updated += 1;
    }

    return updated;
  }

  const collection = getCollection();
  const activeRecords = await collection
    .find({ status: "active" })
    .project({ id: 1, articleUrl: 1, sourceName: 1 })
    .toArray();

  const placeholderIds = activeRecords
    .filter((record) => shouldExpireStoredArticleUrl(record.articleUrl, record.sourceName))
    .map((record) => record.id);

  if (placeholderIds.length === 0) {
    return 0;
  }

  const result = await collection.updateMany(
    { id: { $in: placeholderIds }, status: "active" },
    {
      $set: {
        status: "expired",
        updatedAt: now,
      },
    },
  );

  return result.modifiedCount;
}

export async function markExpiredPublicNewsRecords(now = new Date().toISOString()): Promise<number> {
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    let updated = 0;

    for (const [id, record] of memoryRecords.entries()) {
      if (record.expiresAt <= now && record.status === "active") {
        memoryRecords.set(id, {
          ...record,
          status: "expired",
          updatedAt: now,
        });
        updated += 1;
      }
    }

    return updated;
  }

  const collection = getCollection();
  const result = await collection.updateMany(
    {
      expiresAt: { $lte: now },
      status: "active",
    },
    {
      $set: {
        status: "expired",
        updatedAt: now,
      },
    },
  );

  return result.modifiedCount;
}

export async function deleteExpiredPublicNewsRecords(now = new Date().toISOString()): Promise<number> {
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    let deleted = 0;

    for (const [id, record] of memoryRecords.entries()) {
      if (record.expiresAt <= now) {
        memoryRecords.delete(id);
        deleted += 1;
      }
    }

    return deleted;
  }

  const collection = getCollection();
  const result = await collection.deleteMany({ expiresAt: { $lte: now } });
  return result.deletedCount;
}

export async function countPublicNewsRecords(): Promise<number> {
  const mode = resolvePublicNewsPersistenceMode();

  if (mode === "memory") {
    return memoryRecords.size;
  }

  return getCollection().countDocuments();
}
