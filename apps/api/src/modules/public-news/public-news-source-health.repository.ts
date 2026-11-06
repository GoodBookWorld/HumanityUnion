/**
 * RSS-HEALTH-01 — one health record per NEWS_SOURCE MediaResource id, replaced on
 * each check (no history). Uses the public-news persistence mode.
 */

import type { PublicNewsSourceHealthRecord } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../infrastructure/mongodb/mongo-collections.js";
import { getMongoCollection } from "../../infrastructure/mongodb/mongo-database.js";

import { mergeSourceCheck, type PublicNewsSourceCheck } from "./public-news-source-health.js";
import { resolvePublicNewsPersistenceMode } from "./public-news.repository.js";

const memoryHealth = new Map<string, PublicNewsSourceHealthRecord>();
let failWritesForTests = false;

function getCollection() {
  return getMongoCollection<PublicNewsSourceHealthRecord>(MONGO_COLLECTIONS.publicNewsSourceHealth);
}

export function resetPublicNewsSourceHealthForTests(): void {
  memoryHealth.clear();
  failWritesForTests = false;
}

export function setPublicNewsSourceHealthWriteFailureForTests(enabled: boolean): void {
  failWritesForTests = enabled;
}

export async function listPublicNewsSourceHealth(
  mediaResourceIds: readonly string[],
): Promise<Map<string, PublicNewsSourceHealthRecord>> {
  const ids = [...new Set(mediaResourceIds)];
  const result = new Map<string, PublicNewsSourceHealthRecord>();
  if (ids.length === 0) {
    return result;
  }
  if (resolvePublicNewsPersistenceMode() === "memory") {
    for (const id of ids) {
      const record = memoryHealth.get(id);
      if (record) {
        result.set(id, structuredClone(record));
      }
    }
    return result;
  }
  const docs = await getCollection()
    .find({ mediaResourceId: { $in: ids } }, { projection: { _id: 0 } })
    .limit(ids.length)
    .toArray();
  for (const doc of docs) {
    result.set(doc.mediaResourceId, doc as PublicNewsSourceHealthRecord);
  }
  return result;
}

export async function recordPublicNewsSourceChecks(
  checks: readonly PublicNewsSourceCheck[],
): Promise<void> {
  if (failWritesForTests) {
    throw new Error("Simulated source health write failure.");
  }
  if (checks.length === 0) {
    return;
  }
  const previous = await listPublicNewsSourceHealth(checks.map((check) => check.mediaResourceId));
  const merged = checks.map((check) =>
    mergeSourceCheck(previous.get(check.mediaResourceId) ?? null, check),
  );
  if (resolvePublicNewsPersistenceMode() === "memory") {
    for (const record of merged) {
      memoryHealth.set(record.mediaResourceId, structuredClone(record));
    }
    return;
  }
  await getCollection().bulkWrite(
    merged.map((record) => ({
      replaceOne: {
        filter: { mediaResourceId: record.mediaResourceId },
        replacement: record,
        upsert: true,
      },
    })),
    { ordered: false },
  );
}
