/**
 * Task 07.1 — Staging read-only preflight for production Initiative/civic migration.
 *
 * Requires: MONGODB_DATABASE === humanity_union_staging
 * No writes. No --execute. No R2 copy.
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
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  ProductionInitiativeMigrationError,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  assertStagingSourceDatabase,
  runStagingInitiativeMigrationPreflight,
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
  assertStagingSourceDatabase(config.database);

  await connectMongoClient();
  try {
    const report = await runStagingInitiativeMigrationPreflight({
      db: getMongoClient().db(config.database),
      databaseName: config.database,
    });

    const text = JSON.stringify(
      {
        ...report,
        requiredSourceDatabase: PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
      },
      null,
      2,
    );
    assertNoSecretLeak(text);
    console.log(text);
    if (report.overallVerdict !== "PASS") {
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
      tool: "preflight-staging-production-initiative-migration",
      ok: false,
      mode: "read-only",
      error: message,
    }),
  );
  process.exitCode = 1;
});
