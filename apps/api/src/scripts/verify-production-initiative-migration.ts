/**
 * Task 07.6 — Read-only post-execute verifier for production Initiative migration.
 *
 * Verifies destination Mongo + dual R2 after controlled execute.
 * Never writes Mongo/R2. Projection probe may be unavailable until production API restart.
 *
 * Requires dual Mongo + dual R2 env (same as execute/media preflight).
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DualBucketR2MediaCopyExecutor,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  resolveDualMongoEnv,
  resolveDualR2MediaCopyConfig,
  runPostExecuteProductionInitiativeVerification,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  assertNoWritePathRequested();

  const dual = resolveDualMongoEnv();
  if (dual.sourceDatabase !== PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE) {
    throw new Error(
      `Source database must be ${PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE}`,
    );
  }
  if (dual.destinationDatabase !== PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE) {
    throw new Error(
      `Destination database must be ${PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE}`,
    );
  }

  const r2 = resolveDualR2MediaCopyConfig();
  const mediaReader = new DualBucketR2MediaCopyExecutor(r2);

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runPostExecuteProductionInitiativeVerification({
      sourceDb: sourceClient.db(dual.sourceDatabase),
      destinationDb: destinationClient.db(dual.destinationDatabase),
      mediaReader,
      // Staging shell cannot observe production in-process projections.
      probePublicInitiative: async () => "unavailable",
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: mediaReader.getWriteCount(),
        deleteObjectCalls: mediaReader.getDeleteCount(),
        recoveryStoreWrites: 0,
      },
    });

    const payload = {
      ...report,
      note:
        report.verdict === "PROJECTION_RESTART_REQUIRED"
          ? "Mongo/R2 verification passed; restart production API (or hydrate initiatives) then re-check public Initiative projection endpoints."
          : "Read-only post-execute verification; no Mongo/R2 writes.",
      operatorProjectionCheck:
        "After production API restart, GET public Initiative routes for each migrated public Initiative and confirm HTTP 200 with expected titles/stewards.",
    };
    assertNoSecretLeak(JSON.stringify(payload));
    console.log(JSON.stringify(payload, null, 2));
    if (report.verdict === "FAIL") {
      process.exitCode = 1;
    } else if (report.verdict === "PROJECTION_RESTART_REQUIRED") {
      process.exitCode = 2;
    }
  } finally {
    await sourceClient.close();
    await destinationClient.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/[A-Za-z0-9+/_-]{24,}/g, "[redacted]");
  const text = JSON.stringify({
    tool: "verify-production-initiative-migration",
    ok: false,
    mode: "read-only",
    error: safe,
  });
  try {
    assertNoSecretLeak(text);
    console.error(text);
  } catch {
    console.error(
      JSON.stringify({
        tool: "verify-production-initiative-migration",
        ok: false,
        mode: "read-only",
        error: "Verification failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
