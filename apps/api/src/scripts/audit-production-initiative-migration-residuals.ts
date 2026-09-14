/**
 * Task 07.7.6 — Read-only residual audit for a failed production Initiative migration execution.
 *
 * Never writes Mongo/R2. Never accepts --execute.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DualBucketR2MediaCopyExecutor,
  FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_INITIATIVE_MIGRATION_TARGET_DATABASE,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  resolveDualMongoEnv,
  resolveDualR2MediaCopyConfig,
  runFailedExecutionResidualAudit,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

function parseBaselineVisibility(argv: readonly string[]): boolean | null | undefined {
  const raw = argv.find((arg) => arg.startsWith("--baseline-membership-publicly-visible="));
  if (!raw) return undefined;
  const value = raw.slice("--baseline-membership-publicly-visible=".length).trim().toLowerCase();
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === "absent" || value === "null") return null;
  throw new Error(
    "Invalid --baseline-membership-publicly-visible= (use true|false|absent)",
  );
}

function parseExecutionId(argv: readonly string[]): string {
  const raw = argv.find((arg) => arg.startsWith("--execution-id="));
  if (!raw) return FAILED_PRODUCTION_INITIATIVE_MIGRATION_EXECUTION_ID;
  const value = raw.slice("--execution-id=".length).trim();
  if (!value.startsWith("mig_")) {
    throw new Error("execution-id must start with mig_");
  }
  return value;
}

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
  const migrationExecutionId = parseExecutionId(process.argv);
  const baselineMembershipPubliclyVisible = parseBaselineVisibility(process.argv);

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runFailedExecutionResidualAudit({
      sourceDb: sourceClient.db(dual.sourceDatabase),
      destinationDb: destinationClient.db(dual.destinationDatabase),
      mediaReader,
      migrationExecutionId,
      baselineMembershipPubliclyVisible,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: mediaReader.getWriteCount(),
        deleteObjectCalls: mediaReader.getDeleteCount(),
        recoveryStoreWrites: 0,
      },
    });

    const payload = {
      ...report,
      note: "Read-only residual audit; never deletes recovery evidence; no Mongo/R2 writes.",
    };
    assertNoSecretLeak(JSON.stringify(payload));
    console.log(JSON.stringify(payload, null, 2));
    if (report.verdict === "RESIDUAL_CLEANUP_REQUIRED") {
      process.exitCode = 1;
    } else if (report.verdict === "AUDIT_INDETERMINATE") {
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
    tool: "audit-production-initiative-migration-residuals",
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
        tool: "audit-production-initiative-migration-residuals",
        ok: false,
        mode: "read-only",
        error: "Residual audit failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
