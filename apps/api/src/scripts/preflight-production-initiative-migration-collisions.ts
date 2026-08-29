/**
 * Task 07.1 — Production read-only collision preflight for Initiative/civic migration.
 *
 * Requires: MONGODB_DATABASE === humanity_union_production
 * No writes. No --execute.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import {
  connectMongoClient,
  disconnectMongoClient,
  getMongoClient,
} from "../infrastructure/mongodb/mongo-connection.js";
import {
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  ProductionInitiativeMigrationError,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  assertProductionCollisionDatabase,
  runProductionCollisionPreflight,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  assertNoWritePathRequested();

  if (!isMongoConfigured()) {
    throw new ProductionInitiativeMigrationError(
      "MongoDB is not configured.",
      "MONGO_UNCONFIGURED",
    );
  }

  const config = resolveMongoConfig();
  assertProductionCollisionDatabase(config.database);

  await connectMongoClient();
  try {
    const report = await runProductionCollisionPreflight({
      db: getMongoClient().db(config.database),
      databaseName: config.database,
    });

    const text = JSON.stringify(
      {
        ...report,
        requiredDatabase: PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
      },
      null,
      2,
    );
    assertNoSecretLeak(text);
    console.log(text);
    if (report.collisionVerdict !== "PASS") {
      process.exitCode = 1;
    }
  } finally {
    await disconnectMongoClient();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      tool: "preflight-production-initiative-migration-collisions",
      ok: false,
      mode: "read-only",
      error: message,
    }),
  );
  process.exitCode = 1;
});
