/**
 * Task 07.7.9 — Guarded reconciler for stale durable media recovery rollback state.
 *
 * Default: dry-run (HEAD/inspect only; zero writes).
 *
 * Execute requires ALL of:
 *   --execute
 *   --execution-id=mig_… (exact; never all)
 *   PRODUCTION_INITIATIVE_MIGRATION_CONFIRM=YES
 *   destination Mongo = production database
 *   destination R2 credentials for HEAD/inspect only
 *
 * Never PutObject / DeleteObject.
 * Writes only production_initiative_migration_media_recovery status → rollback_deleted
 * when destination object is proven ABSENT.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DESTINATION_MONGODB_DATABASE_ENV,
  DESTINATION_MONGODB_URI_ENV,
  DualBucketR2MediaCopyExecutor,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  ProductionInitiativeMigrationError,
  assertNoSecretLeak,
  isExecuteModeRequested,
  reconcileProductionInitiativeMigrationRecoveryRollbackState,
  resolveDualR2MediaCopyConfig,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

function parseExecutionId(argv: readonly string[]): string {
  const raw = argv.find((arg) => arg.startsWith("--execution-id="));
  if (!raw) {
    throw new ProductionInitiativeMigrationError(
      "Required: --execution-id=mig_… (exact failed migration execution id).",
      "MISSING_EXECUTION_ID",
    );
  }
  return raw.slice("--execution-id=".length).trim();
}

async function main(): Promise<void> {
  const executeRequested = isExecuteModeRequested();
  const confirm = process.env[PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG];
  const migrationExecutionId = parseExecutionId(process.argv);

  if (executeRequested && confirm !== PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE) {
    throw new ProductionInitiativeMigrationError(
      `Refusing write: set ${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_INITIATIVE_MIGRATION_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }

  const destinationUri = process.env[DESTINATION_MONGODB_URI_ENV]?.trim() ?? "";
  const destinationDatabase = process.env[DESTINATION_MONGODB_DATABASE_ENV]?.trim() ?? "";
  if (!destinationUri || !destinationDatabase) {
    throw new ProductionInitiativeMigrationError(
      `Set ${DESTINATION_MONGODB_URI_ENV} and ${DESTINATION_MONGODB_DATABASE_ENV}.`,
      "MISSING_DESTINATION_MONGO",
    );
  }
  if (destinationDatabase !== PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE) {
    throw new ProductionInitiativeMigrationError(
      `Destination database must be ${PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE}.`,
      "WRONG_DESTINATION_DATABASE",
    );
  }

  const r2 = resolveDualR2MediaCopyConfig();
  const mediaReader = new DualBucketR2MediaCopyExecutor(r2);

  const destinationClient = new MongoClient(destinationUri);
  await destinationClient.connect();
  try {
    const report = await reconcileProductionInitiativeMigrationRecoveryRollbackState({
      destinationDb: destinationClient.db(destinationDatabase),
      mediaReader,
      migrationExecutionId,
      destinationDatabase,
      execute: executeRequested,
      confirm,
    });

    const payload = {
      ...report,
      note:
        report.mode === "dry-run"
          ? "Dry-run only; zero Mongo/R2 writes. Re-run with --execute and CONFIRM=YES to update recovery status."
          : "Recovery status updates only; no R2 Put/Delete; recovery documents retained.",
    };
    assertNoSecretLeak(JSON.stringify(payload));
    console.log(JSON.stringify(payload, null, 2));
    if (report.verdict === "BLOCKED") {
      process.exitCode = 1;
    }
  } finally {
    await destinationClient.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/[A-Za-z0-9+/_-]{24,}/g, "[redacted]");
  const text = JSON.stringify({
    tool: "reconcile-production-initiative-migration-recovery-rollback-state",
    ok: false,
    error: safe,
  });
  try {
    assertNoSecretLeak(text);
    console.error(text);
  } catch {
    console.error(
      JSON.stringify({
        tool: "reconcile-production-initiative-migration-recovery-rollback-state",
        ok: false,
        error: "Recovery rollback-state reconcile failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
