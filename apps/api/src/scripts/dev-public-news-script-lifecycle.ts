import { initializeEnvironment } from "../config/environment.js";
import { loadApiEnvironment } from "../config/load-api-environment.js";
import { assertMongoConfigured, isMongoConfigured } from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import { ensureMongoIndexes } from "../infrastructure/mongodb/mongo-indexes.js";
import { resolvePublicNewsPersistenceMode } from "../modules/public-news/public-news.repository.js";

/**
 * Mirrors the API server's MongoDB startup for standalone public-news scripts:
 * load env, connect, ensure indexes when public news uses MongoDB persistence.
 */
export async function bootstrapPublicNewsScriptMongo(): Promise<boolean> {
  loadApiEnvironment();
  initializeEnvironment();

  if (resolvePublicNewsPersistenceMode() !== "mongodb") {
    return false;
  }

  if (!isMongoConfigured()) {
    throw new Error("PUBLIC_NEWS_PERSISTENCE=mongodb requires MONGODB_URI to be configured.");
  }

  assertMongoConfigured();
  await connectMongoClient();
  await ensureMongoIndexes();
  return true;
}

export async function teardownPublicNewsScriptMongo(connected: boolean): Promise<void> {
  if (!connected) {
    return;
  }

  await disconnectMongoClient().catch(() => undefined);
}

export async function withPublicNewsScriptMongo<T>(run: () => Promise<T>): Promise<T> {
  const connected = await bootstrapPublicNewsScriptMongo();

  try {
    return await run();
  } finally {
    await teardownPublicNewsScriptMongo(connected);
  }
}
