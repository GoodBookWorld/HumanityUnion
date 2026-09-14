/**
 * Blog Production Migration 04.4 — Post-commit media URL recovery.
 *
 * Default: DRY-RUN (zero Mongo/R2/email/outbox writes).
 *
 * Execute requires ALL of:
 *   --execute
 *   PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM=YES
 *   explicit --migration-execution-id=mig_…
 *   durable run mongoTransactionStatus=committed
 *   destination humanity_union_production
 *   source != destination
 *
 * DO NOT run --execute against production from automation without operator GO.
 * Never copies or deletes R2 objects. Never reruns migration.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  BLOG_DESTINATION_MONGODB_DATABASE_ENV,
  BLOG_DESTINATION_MONGODB_URI_ENV,
  BLOG_SOURCE_MONGODB_DATABASE_ENV,
  BLOG_SOURCE_MONGODB_URI_ENV,
  DualBucketBlogR2CopyExecutor,
  PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG,
  PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE,
  ProductionBlogMigrationError,
  assertNoSecretLeak,
  isBlogMediaUrlRecoveryExecuteRequested,
  isBlogMigrationR2Configured,
  resolveBlogMediaUrlRecoveryMode,
  resolveDualBlogMongoEnv,
  resolveDualBlogR2CopyConfig,
  runBlogMediaUrlRecovery,
} from "../modules/production-blog-migration/index.js";

loadApiEnvironment();

function readMigrationExecutionId(argv: readonly string[] = process.argv): string {
  const eq = argv.find((a) => a.startsWith("--migration-execution-id="));
  if (eq) return eq.slice("--migration-execution-id=".length).trim();
  const idx = argv.indexOf("--migration-execution-id");
  if (idx >= 0 && argv[idx + 1]) return String(argv[idx + 1]).trim();
  return (process.env.PRODUCTION_BLOG_MEDIA_URL_RECOVERY_MIGRATION_ID ?? "").trim();
}

async function main(): Promise<void> {
  const executeRequested = isBlogMediaUrlRecoveryExecuteRequested();
  const confirm = process.env[PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG];
  const migrationExecutionId = readMigrationExecutionId();
  const dual = resolveDualBlogMongoEnv();

  const mode = resolveBlogMediaUrlRecoveryMode({
    execute: executeRequested,
    confirm,
  });

  if (!migrationExecutionId) {
    throw new ProductionBlogMigrationError(
      "Pass --migration-execution-id=mig_… (required).",
      "MISSING_MIGRATION_EXECUTION_ID",
    );
  }

  if (executeRequested && mode === "dry-run") {
    throw new ProductionBlogMigrationError(
      `Refusing write: set ${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG}=${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }

  if (!isBlogMigrationR2Configured()) {
    throw new ProductionBlogMigrationError(
      "Blog dual-R2 credentials required for post-repair verification.",
      "R2_REQUIRED_FOR_RECOVERY_VERIFY",
    );
  }

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runBlogMediaUrlRecovery({
      handles: {
        sourceClient,
        sourceDb: sourceClient.db(dual.sourceDatabase),
        sourceDatabase: dual.sourceDatabase,
        destinationClient,
        destinationDb: destinationClient.db(dual.destinationDatabase),
        destinationDatabase: dual.destinationDatabase,
      },
      migrationExecutionId,
      execute: executeRequested,
      confirm,
      mediaExecutor: new DualBucketBlogR2CopyExecutor(resolveDualBlogR2CopyConfig()),
    });

    const payload = {
      ...report,
      dualConnectionEnv: {
        sourceUriEnv: BLOG_SOURCE_MONGODB_URI_ENV,
        sourceDatabaseEnv: BLOG_SOURCE_MONGODB_DATABASE_ENV,
        destinationUriEnv: BLOG_DESTINATION_MONGODB_URI_ENV,
        destinationDatabaseEnv: BLOG_DESTINATION_MONGODB_DATABASE_ENV,
      },
      confirmRequired: `${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_FLAG}=${PRODUCTION_BLOG_MEDIA_URL_RECOVERY_CONFIRM_VALUE}`,
      note:
        mode === "dry-run"
          ? "Dry-run only. Zero Mongo/R2 writes. Pass --execute with CONFIRM=YES for production URL repair."
          : "Execute mode. Operator must not run against production without GO.",
    };
    const text = JSON.stringify(payload, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
    if (
      report.overallStatus === "FAILED" ||
      report.overallStatus === "BLOCKED" ||
      report.overallStatus === "VERIFIER_FAIL"
    ) {
      process.exitCode = 1;
    }
  } finally {
    await sourceClient.close();
    await destinationClient.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/[A-Za-z0-9+/_-]{24,}/g, "[redacted]");
  try {
    assertNoSecretLeak(safe);
    console.error(
      JSON.stringify({
        tool: "recover-production-blog-media-urls",
        ok: false,
        error: safe,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        tool: "recover-production-blog-media-urls",
        ok: false,
        error: "[redacted]",
      }),
    );
  }
  process.exitCode = 1;
});
