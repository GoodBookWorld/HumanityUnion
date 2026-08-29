/**
 * Task 07.2 — Controlled staging → production Initiative migration executor.
 *
 * Default: DRY-RUN (no writes, no R2 copy).
 *
 * Execute requires ALL of:
 *   --execute
 *   PRODUCTION_INITIATIVE_MIGRATION_CONFIRM=YES
 *   explicit dual source/destination Mongo URIs + database names
 *   immediate inline execution preflight PASS on those exact handles + 9-ID set
 *
 * Media R2 copy remains deferred. Task 07.2 does not perform R2 copies.
 * Stale manually-set fresh-preflight env flags are intentionally insufficient;
 * write authorization is the executor's immediate inline preflight only.
 *
 * DO NOT RUN --execute against production until operator GO.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DESTINATION_MONGODB_DATABASE_ENV,
  DESTINATION_MONGODB_URI_ENV,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  SOURCE_MONGODB_DATABASE_ENV,
  SOURCE_MONGODB_URI_ENV,
  ProductionInitiativeMigrationError,
  assertNoSecretLeak,
  buildSafeMigrationExecutionLog,
  isExecuteModeRequested,
  resolveDualMongoEnv,
  resolveMigrationMode,
  runProductionInitiativeMigration,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const executeRequested = isExecuteModeRequested();
  const confirm = process.env[PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG];
  const dual = resolveDualMongoEnv();

  const mode = resolveMigrationMode({
    execute: executeRequested,
    confirm,
  });

  if (executeRequested && mode === "dry-run") {
    throw new ProductionInitiativeMigrationError(
      `Refusing write: set ${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);

  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runProductionInitiativeMigration({
      handles: {
        sourceClient,
        sourceDb: sourceClient.db(dual.sourceDatabase),
        sourceDatabase: dual.sourceDatabase,
        destinationClient,
        destinationDb: destinationClient.db(dual.destinationDatabase),
        destinationDatabase: dual.destinationDatabase,
      },
      execute: executeRequested,
      confirm,
      // Task 07.2: never copy R2 from this script.
      performMediaCopies: false,
    });

    const payload = {
      ...buildSafeMigrationExecutionLog(report),
      dualConnectionEnv: {
        sourceUriEnv: SOURCE_MONGODB_URI_ENV,
        sourceDatabaseEnv: SOURCE_MONGODB_DATABASE_ENV,
        destinationUriEnv: DESTINATION_MONGODB_URI_ENV,
        destinationDatabaseEnv: DESTINATION_MONGODB_DATABASE_ENV,
      },
      confirmRequired: `${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE}`,
      writeAuthorization: "inlineExecutionPreflight",
      mediaCopy: "deferred",
    };
    const text = JSON.stringify(payload, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
    if (report.overallStatus === "FAILED") {
      process.exitCode = 1;
    }
  } finally {
    await sourceClient.close();
    await destinationClient.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(
    JSON.stringify({
      tool: "execute-production-initiative-migration",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});
