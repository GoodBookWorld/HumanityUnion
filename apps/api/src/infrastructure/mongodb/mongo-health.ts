import { isMongoConfigured } from "./mongo-config.js";
import { connectMongoClient } from "./mongo-connection.js";
import { getMongoDatabase } from "./mongo-database.js";

export interface MongoHealthCheckResult {
  connected: boolean;
  database: string | null;
  latencyMs: number | null;
  error: string | null;
}

export async function checkMongoConnection(): Promise<MongoHealthCheckResult> {
  if (!isMongoConfigured()) {
    return {
      connected: false,
      database: null,
      latencyMs: null,
      error: "MONGODB_URI is not configured.",
    };
  }

  const startedAt = Date.now();

  try {
    const client = await connectMongoClient();
    const database = getMongoDatabase();
    await client.db(database.databaseName).command({ ping: 1 });

    return {
      connected: true,
      database: database.databaseName,
      latencyMs: Date.now() - startedAt,
      error: null,
    };
  } catch (error) {
    return {
      connected: false,
      database: null,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "MongoDB connection failed.",
    };
  }
}
