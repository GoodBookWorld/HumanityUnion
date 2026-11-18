/**
 * HU-RRP-03H.1 — minimal isolated Mongo replica-set harness (no Docker, no paid cloud).
 *
 * Starts a process-owned MongoMemoryReplSet and prints env values for a local API
 * pointed at an ephemeral hu_test_ database. Does not start API/WEB itself and does
 * not touch Production Mongo.
 *
 * Usage:
 *   pnpm --filter @hu/api exec tsx ./scripts/rrp-03h-isolated-mongo-harness.mts
 *
 * Then in other terminals (isolated only):
 *   export MONGODB_URI=…   # printed below
 *   export MONGODB_DATABASE=… # printed below
 *   # API: pnpm --filter @hu/api dev   (against this URI)
 *   # WEB: NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true pnpm --filter @hu/web build && … start
 *   # Browser: RRP_E2E_BASE_URL=… RRP_E2E_PARTICIPANT_EMAIL=… … pnpm --filter @hu/web exec playwright test rrp-03h-browser
 *
 * Stop: Ctrl+C (drops the ephemeral database when possible).
 */
import { MongoMemoryReplSet } from "mongodb-memory-server-core";
import { MongoClient } from "mongodb";

import { generateIsolatedTestDatabaseName } from "./test-mongo-isolation.js";

const database = generateIsolatedTestDatabaseName();

async function main(): Promise<void> {
  console.log("HU-RRP-03H.1 isolated MongoMemoryReplSet harness starting…");
  const replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  const uri = replSet.getUri(database);
  const hostname = new URL(uri.replace(/^mongodb:/, "http:")).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost") {
    await replSet.stop({ doCleanup: true });
    throw new Error(`Refusing non-local MemoryReplSet host: ${hostname}`);
  }

  console.log("");
  console.log("# Isolated replica-set Mongo is ready (local only).");
  console.log(`export MONGODB_URI='${uri}'`);
  console.log(`export MONGODB_DATABASE='${database}'`);
  console.log("export NODE_TEST_ENV=false");
  console.log("");
  console.log("# WEB isolated build (Production/default builds must keep flag OFF):");
  console.log("export NEXT_PUBLIC_RRP_APPLICATION_ENTRY_ENABLED=true");
  console.log("");
  console.log("# Playwright (only after API+WEB+test accounts exist against this DB):");
  console.log("export RRP_E2E_BASE_URL='http://127.0.0.1:3000'");
  console.log("# export RRP_E2E_PARTICIPANT_EMAIL=… RRP_E2E_PARTICIPANT_PASSWORD=…");
  console.log("# export RRP_E2E_ADMIN_EMAIL=… RRP_E2E_ADMIN_PASSWORD=…");
  console.log("");
  console.log("Harness holding replica set open. Press Ctrl+C to stop and cleanup.");

  const shutdown = async () => {
    try {
      const client = new MongoClient(uri);
      await client.connect();
      await client.db(database).dropDatabase();
      await client.close();
    } catch (error) {
      console.warn("Cleanup warning:", error instanceof Error ? error.message : error);
    }
    await replSet.stop({ doCleanup: true });
    process.exit(0);
  };

  process.on("SIGINT", () => {
    void shutdown();
  });
  process.on("SIGTERM", () => {
    void shutdown();
  });

  // Keep alive until signal.
  await new Promise(() => undefined);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
