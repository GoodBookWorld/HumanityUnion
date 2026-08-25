import type { SeoPageOverride, SeoPageOverrideFamily } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { SeoPageOverridePersistenceError } from "../seo-page-overrides.errors.js";
import {
  deleteSeoPageOverrideMemory,
  getSeoPageOverrideMemory,
  listSeoPageOverridesMemory,
  resetSeoPageOverridesMemoryForTests,
  upsertSeoPageOverrideMemory,
} from "./seo-page-overrides.memory.store.js";
import {
  fromSeoPageOverrideMongoDocument,
  toSeoPageOverrideMongoDocument,
  type SeoPageOverrideMongoDocument,
} from "./seo-page-overrides.mongo-document.js";

let forceMemoryForTests = false;

export function setSeoPageOverridesForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetSeoPageOverridesStoreForTests(): void {
  resetSeoPageOverridesMemoryForTests();
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new SeoPageOverridePersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<SeoPageOverrideMongoDocument>(MONGO_COLLECTIONS.seoPageOverrides);
}

export async function getSeoPageOverrideByPageId(
  pageId: string,
): Promise<SeoPageOverride | null> {
  if (shouldUseMemoryAdapter()) {
    return getSeoPageOverrideMemory(pageId);
  }

  await ensureMongoReady();
  try {
    const doc = await collection().findOne({ pageId });
    return doc ? fromSeoPageOverrideMongoDocument(doc) : null;
  } catch (error) {
    throw new SeoPageOverridePersistenceError("Failed to load SEO page override.", error);
  }
}

export async function listSeoPageOverrides(input?: {
  family?: SeoPageOverrideFamily;
}): Promise<SeoPageOverride[]> {
  if (shouldUseMemoryAdapter()) {
    return listSeoPageOverridesMemory(input?.family);
  }

  await ensureMongoReady();
  try {
    const filter = input?.family ? { family: input.family } : {};
    const docs = await collection().find(filter).toArray();
    return docs.map(fromSeoPageOverrideMongoDocument);
  } catch (error) {
    throw new SeoPageOverridePersistenceError("Failed to list SEO page overrides.", error);
  }
}

export async function upsertSeoPageOverride(
  override: SeoPageOverride,
): Promise<SeoPageOverride> {
  if (shouldUseMemoryAdapter()) {
    return upsertSeoPageOverrideMemory(override);
  }

  await ensureMongoReady();
  try {
    await collection().replaceOne(
      { pageId: override.pageId },
      toSeoPageOverrideMongoDocument(override),
      { upsert: true },
    );
    return override;
  } catch (error) {
    throw new SeoPageOverridePersistenceError("Failed to save SEO page override.", error);
  }
}

export async function deleteSeoPageOverride(pageId: string): Promise<boolean> {
  if (shouldUseMemoryAdapter()) {
    return deleteSeoPageOverrideMemory(pageId);
  }

  await ensureMongoReady();
  try {
    const result = await collection().deleteOne({ pageId });
    return (result.deletedCount ?? 0) > 0;
  } catch (error) {
    throw new SeoPageOverridePersistenceError("Failed to clear SEO page override.", error);
  }
}
