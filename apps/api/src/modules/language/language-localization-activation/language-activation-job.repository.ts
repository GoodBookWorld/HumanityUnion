/**
 * Language Activation Job repository — Mongo + memory.
 */

import type { LanguageActivationJobRecord } from "@hu/types";
import { normalizeLanguageRegistryLocaleKey } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { LanguageActivationJobPersistenceError } from "./language-activation-job.errors.js";
import {
  getActiveLanguageActivationJobByLocaleMemory,
  getLanguageActivationJobByIdMemory,
  getLatestLanguageActivationJobByLocaleMemory,
  listLanguageActivationJobMemory,
  resetLanguageActivationJobMemoryForTests,
  upsertLanguageActivationJobMemory,
} from "./language-activation-job.memory.store.js";
import {
  fromLanguageActivationJobMongoDocument,
  toLanguageActivationJobMongoDocument,
  type LanguageActivationJobMongoDocument,
} from "./language-activation-job.mongo-document.js";

let forceMemoryForTests = false;

export function setLanguageActivationJobForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetLanguageActivationJobStoreForTests(): void {
  resetLanguageActivationJobMemoryForTests();
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new LanguageActivationJobPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<LanguageActivationJobMongoDocument>(
    MONGO_COLLECTIONS.languageActivationJobs,
  );
}

export async function listLanguageActivationJobs(): Promise<
  readonly LanguageActivationJobRecord[]
> {
  if (shouldUseMemoryAdapter()) {
    return [...listLanguageActivationJobMemory()].sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt),
    );
  }
  await ensureMongoReady();
  const docs = await collection().find({}).toArray();
  return docs
    .map((doc) => fromLanguageActivationJobMongoDocument(doc))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getLanguageActivationJobById(
  jobId: string,
): Promise<LanguageActivationJobRecord | null> {
  if (!jobId.trim()) {
    return null;
  }
  if (shouldUseMemoryAdapter()) {
    return getLanguageActivationJobByIdMemory(jobId);
  }
  await ensureMongoReady();
  const doc = await collection().findOne({ jobId });
  return doc ? fromLanguageActivationJobMongoDocument(doc) : null;
}

export async function getLatestLanguageActivationJobByLocale(
  locale: string,
): Promise<LanguageActivationJobRecord | null> {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return null;
  }
  if (shouldUseMemoryAdapter()) {
    return getLatestLanguageActivationJobByLocaleMemory(localeKey);
  }
  await ensureMongoReady();
  const docs = await collection()
    .find({ localeKey })
    .sort({ generation: -1, updatedAt: -1 })
    .limit(1)
    .toArray();
  const doc = docs[0];
  return doc ? fromLanguageActivationJobMongoDocument(doc) : null;
}

export async function getActiveLanguageActivationJobByLocale(
  locale: string,
): Promise<LanguageActivationJobRecord | null> {
  const localeKey = normalizeLanguageRegistryLocaleKey(locale);
  if (!localeKey) {
    return null;
  }
  if (shouldUseMemoryAdapter()) {
    return getActiveLanguageActivationJobByLocaleMemory(localeKey);
  }
  await ensureMongoReady();
  const docs = await collection()
    .find({
      localeKey,
      status: { $in: ["queued", "running", "waiting_for_data"] },
    })
    .sort({ generation: -1 })
    .limit(1)
    .toArray();
  const doc = docs[0];
  return doc ? fromLanguageActivationJobMongoDocument(doc) : null;
}

export async function saveLanguageActivationJob(
  record: LanguageActivationJobRecord,
): Promise<LanguageActivationJobRecord> {
  if (shouldUseMemoryAdapter()) {
    return upsertLanguageActivationJobMemory(record);
  }
  await ensureMongoReady();
  const doc = toLanguageActivationJobMongoDocument(record);
  await collection().updateOne(
    { jobId: record.jobId },
    { $set: doc },
    { upsert: true },
  );
  return record;
}
