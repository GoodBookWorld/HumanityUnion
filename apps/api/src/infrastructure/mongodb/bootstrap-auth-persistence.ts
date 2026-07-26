import { isMongoConfigured } from "./mongo-config.js";
import { connectMongoClient } from "./mongo-connection.js";
import { ensureMongoIndexes } from "./mongo-indexes.js";

/**
 * Connects to MongoDB and ensures auth collection indexes when MONGODB_URI is configured.
 */
export async function bootstrapAuthPersistence(): Promise<void> {
  if (!isMongoConfigured()) {
    return;
  }

  await connectMongoClient();
  await ensureMongoIndexes();
}
