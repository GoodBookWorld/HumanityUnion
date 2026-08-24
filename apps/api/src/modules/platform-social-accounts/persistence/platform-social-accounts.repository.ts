/**
 * Pack 17C — persistence for canonical platform social account URLs.
 */
import type { PlatformSocialAccount, PlatformSocialNetworkId } from "@hu/types";
import { PLATFORM_SOCIAL_NETWORK_IDS } from "@hu/types";

import { MONGO_COLLECTIONS } from "../../../infrastructure/mongodb/mongo-collections.js";
import { isMongoConfigured } from "../../../infrastructure/mongodb/mongo-config.js";
import { connectMongoClient } from "../../../infrastructure/mongodb/mongo-connection.js";
import { getMongoCollection } from "../../../infrastructure/mongodb/mongo-database.js";
import { buildSeedPlatformSocialAccount } from "../platform-social-accounts.catalog.js";
import { PlatformSocialAccountPersistenceError } from "../platform-social-accounts.errors.js";
import {
  getPlatformSocialAccountMemory,
  listPlatformSocialAccountsMemory,
  resetPlatformSocialAccountsMemoryForTests,
  upsertPlatformSocialAccountMemory,
} from "./platform-social-accounts.memory.store.js";
import {
  fromPlatformSocialAccountMongoDocument,
  toPlatformSocialAccountMongoDocument,
  type PlatformSocialAccountMongoDocument,
} from "./platform-social-accounts.mongo-document.js";

let forceMemoryForTests = false;
let mongoSeedPromise: Promise<void> | null = null;

export function setPlatformSocialAccountsForceMemoryForTests(enabled: boolean): void {
  forceMemoryForTests = enabled;
}

export function resetPlatformSocialAccountsStoreForTests(): void {
  resetPlatformSocialAccountsMemoryForTests();
  mongoSeedPromise = null;
}

function shouldUseMemoryAdapter(): boolean {
  return forceMemoryForTests || !isMongoConfigured();
}

async function ensureMongoReady(): Promise<void> {
  if (!isMongoConfigured()) {
    throw new PlatformSocialAccountPersistenceError("MongoDB is not configured.");
  }
  await connectMongoClient();
}

function collection() {
  return getMongoCollection<PlatformSocialAccountMongoDocument>(
    MONGO_COLLECTIONS.platformSocialAccounts,
  );
}

async function ensureMongoSeeded(): Promise<void> {
  await ensureMongoReady();
  if (!mongoSeedPromise) {
    mongoSeedPromise = (async () => {
      try {
        for (const networkId of PLATFORM_SOCIAL_NETWORK_IDS) {
          const existing = await collection().findOne({ networkId });
          if (existing) {
            continue;
          }
          const seed = buildSeedPlatformSocialAccount(networkId);
          await collection().replaceOne(
            { networkId },
            toPlatformSocialAccountMongoDocument(seed),
            { upsert: true },
          );
        }
      } catch (error) {
        mongoSeedPromise = null;
        throw new PlatformSocialAccountPersistenceError(
          "Failed to seed platform social accounts.",
          error,
        );
      }
    })();
  }
  await mongoSeedPromise;
}

export async function listPlatformSocialAccounts(): Promise<PlatformSocialAccount[]> {
  if (shouldUseMemoryAdapter()) {
    return listPlatformSocialAccountsMemory();
  }

  await ensureMongoSeeded();
  try {
    const docs = await collection().find({}).toArray();
    const byId = new Map(
      docs.map((doc) => [doc.networkId, fromPlatformSocialAccountMongoDocument(doc)] as const),
    );
    return PLATFORM_SOCIAL_NETWORK_IDS.map(
      (networkId) => byId.get(networkId) ?? buildSeedPlatformSocialAccount(networkId),
    );
  } catch (error) {
    throw new PlatformSocialAccountPersistenceError(
      "Failed to list platform social accounts.",
      error,
    );
  }
}

export async function getPlatformSocialAccountByNetworkId(
  networkId: PlatformSocialNetworkId,
): Promise<PlatformSocialAccount | null> {
  if (shouldUseMemoryAdapter()) {
    return getPlatformSocialAccountMemory(networkId);
  }

  await ensureMongoSeeded();
  try {
    const doc = await collection().findOne({ networkId });
    return doc ? fromPlatformSocialAccountMongoDocument(doc) : null;
  } catch (error) {
    throw new PlatformSocialAccountPersistenceError(
      "Failed to load platform social account.",
      error,
    );
  }
}

export async function upsertPlatformSocialAccount(
  account: PlatformSocialAccount,
): Promise<PlatformSocialAccount> {
  if (shouldUseMemoryAdapter()) {
    return upsertPlatformSocialAccountMemory(account);
  }

  await ensureMongoSeeded();
  try {
    await collection().replaceOne(
      { networkId: account.networkId },
      toPlatformSocialAccountMongoDocument(account),
      { upsert: true },
    );
    return account;
  } catch (error) {
    throw new PlatformSocialAccountPersistenceError(
      "Failed to save platform social account.",
      error,
    );
  }
}
