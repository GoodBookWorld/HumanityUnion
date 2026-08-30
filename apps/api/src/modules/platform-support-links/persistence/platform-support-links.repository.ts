/**
 * Production Completion Pack 01 — persistence for Support operational links.
 */
import type { PlatformSupportLink, PlatformSupportLinkId } from "@hu/types";
import { PLATFORM_SUPPORT_LINK_IDS } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { buildSeedPlatformSupportLink } from "../platform-support-links.catalog.js";
import { PlatformSupportLinkPersistenceError } from "../platform-support-links.errors.js";
import {
  getPlatformSupportLinkMemory,
  listPlatformSupportLinksMemory,
  resetPlatformSupportLinksMemoryForTests,
  upsertPlatformSupportLinkMemory,
} from "./platform-support-links.memory.store.js";
import {
  fromPlatformSupportLinkMongoDocument,
  toPlatformSupportLinkMongoDocument,
  type PlatformSupportLinkMongoDocument,
} from "./platform-support-links.mongo-document.js";

let forceMemoryForTests = false;
let mongoSeedPromise: Promise<void> | null = null;

export function setPlatformSupportLinksForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetPlatformSupportLinksStoreForTests(): void {
  resetPlatformSupportLinksMemoryForTests();
  mongoSeedPromise = null;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new PlatformSupportLinkPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PlatformSupportLinkMongoDocument>(
    MONGO_COLLECTIONS.platformSupportLinks,
  );
}

async function ensureMongoSeeded(): Promise<void> {
  await ensureMongoReady();
  if (!mongoSeedPromise) {
    mongoSeedPromise = (async () => {
      try {
        for (const linkId of PLATFORM_SUPPORT_LINK_IDS) {
          const existing = await collection().findOne({ linkId });
          if (existing) {
            continue;
          }
          const seed = buildSeedPlatformSupportLink(linkId);
          await collection().replaceOne(
            { linkId },
            toPlatformSupportLinkMongoDocument(seed),
            { upsert: true },
          );
        }
      } catch (error) {
        mongoSeedPromise = null;
        throw new PlatformSupportLinkPersistenceError(
          "Failed to seed platform support links.",
          error,
        );
      }
    })();
  }
  await mongoSeedPromise;
}

export async function listPlatformSupportLinks(): Promise<PlatformSupportLink[]> {
  if (shouldUseMemoryAdapter()) {
    return listPlatformSupportLinksMemory();
  }

  await ensureMongoSeeded();
  try {
    const docs = await collection().find({}).toArray();
    const byId = new Map(
      docs.map((doc) => [doc.linkId, fromPlatformSupportLinkMongoDocument(doc)] as const),
    );
    return PLATFORM_SUPPORT_LINK_IDS.map(
      (linkId) => byId.get(linkId) ?? buildSeedPlatformSupportLink(linkId),
    );
  } catch (error) {
    throw new PlatformSupportLinkPersistenceError(
      "Failed to list platform support links.",
      error,
    );
  }
}

export async function getPlatformSupportLinkById(
  linkId: PlatformSupportLinkId,
): Promise<PlatformSupportLink | null> {
  if (shouldUseMemoryAdapter()) {
    return getPlatformSupportLinkMemory(linkId);
  }

  await ensureMongoSeeded();
  try {
    const doc = await collection().findOne({ linkId });
    return doc ? fromPlatformSupportLinkMongoDocument(doc) : null;
  } catch (error) {
    throw new PlatformSupportLinkPersistenceError(
      "Failed to load platform support link.",
      error,
    );
  }
}

export async function upsertPlatformSupportLink(
  link: PlatformSupportLink,
): Promise<PlatformSupportLink> {
  if (shouldUseMemoryAdapter()) {
    return upsertPlatformSupportLinkMemory(link);
  }

  await ensureMongoSeeded();
  try {
    await collection().replaceOne(
      { linkId: link.linkId },
      toPlatformSupportLinkMongoDocument(link),
      { upsert: true },
    );
    return link;
  } catch (error) {
    throw new PlatformSupportLinkPersistenceError(
      "Failed to save platform support link.",
      error,
    );
  }
}
