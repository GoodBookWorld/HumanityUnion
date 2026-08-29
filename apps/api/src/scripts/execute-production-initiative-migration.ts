/**
 * Task 07.2 / 07.3 — Controlled staging → production Initiative migration executor.
 *
 * Default: DRY-RUN (no Mongo writes, no R2 copy).
 *
 * Mongo execute requires ALL of:
 *   --execute
 *   PRODUCTION_INITIATIVE_MIGRATION_CONFIRM=YES
 *   explicit dual source/destination Mongo URIs + database names
 *   immediate inline execution preflight PASS on those exact handles + 9-ID set
 *
 * Physical R2 copy additionally requires:
 *   PRODUCTION_INITIATIVE_MIGRATION_MEDIA_COPY=YES
 *   explicit dual source/destination R2 credentials + buckets
 *   destination public base https://media.huws.org
 *   PRODUCTION_INITIATIVE_MIGRATION_MEDIA_RECOVERY_JOURNAL_PATH (durable JSONL)
 *
 * Crash-safe order: A → B → E1(R2) → C → D → E2 → F
 * (Mongo never commits rewritten public media URLs before verified R2 objects.)
 *
 * performMediaCopies alone is never sufficient.
 * Dry-run never performs R2 writes.
 *
 * DO NOT RUN --execute against production until operator GO.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DESTINATION_MONGODB_DATABASE_ENV,
  DESTINATION_MONGODB_URI_ENV,
  MEDIA_COPY_ENABLED_ENV,
  MEDIA_COPY_ENABLED_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  SOURCE_MONGODB_DATABASE_ENV,
  SOURCE_MONGODB_URI_ENV,
  ProductionInitiativeMigrationError,
  assertNoSecretLeak,
  buildSafeMigrationExecutionLog,
  isExecuteModeRequested,
  resolveDualMongoEnv,
  resolveMediaCopyAuthorization,
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

  const mediaCopyEnvValue = process.env[MEDIA_COPY_ENABLED_ENV];
  const mediaAuth = resolveMediaCopyAuthorization({
    mode,
    confirm,
    // CLI only requests copies when media-copy env is YES under execute mode.
    performMediaCopies:
      mode === "execute" && mediaCopyEnvValue?.trim() === MEDIA_COPY_ENABLED_VALUE,
    mediaCopyEnvValue,
  });

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
      performMediaCopies: mediaAuth.authorized,
      mediaCopyEnvValue,
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
      mediaCopyRequired: `${MEDIA_COPY_ENABLED_ENV}=${MEDIA_COPY_ENABLED_VALUE}`,
      writeAuthorization: "inlineExecutionPreflight",
      mediaCopyAuthorized: mediaAuth.authorized,
      mediaCopy: mediaAuth.authorized ? "authorized-if-planned" : "deferred",
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
