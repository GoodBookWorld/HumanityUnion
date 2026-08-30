/**
 * Blog Production Migration 04 — Controlled staging → production Blog executor.
 *
 * Default: DRY-RUN (no Mongo writes, no R2 copy).
 *
 * Execute requires ALL of:
 *   --execute
 *   PRODUCTION_BLOG_MIGRATION_CONFIRM=YES
 *   fresh preflight PASS in this process
 *   destination database humanity_union_production
 *   source and destination DBs differ
 *   R2 preflight PASS
 *   mediaCopyReady=true
 *
 * DO NOT RUN --execute against production until operator GO.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  BLOG_DESTINATION_MONGODB_DATABASE_ENV,
  BLOG_DESTINATION_MONGODB_URI_ENV,
  BLOG_SOURCE_MONGODB_DATABASE_ENV,
  BLOG_SOURCE_MONGODB_URI_ENV,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG,
  PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE,
  ProductionBlogMigrationError,
  assertNoSecretLeak,
  buildSafeBlogMigrationExecutionLog,
  isBlogExecuteModeRequested,
  isBlogMigrationR2Configured,
  resolveBlogMigrationMode,
  resolveDualBlogMongoEnv,
  runProductionBlogMigration,
} from "../modules/production-blog-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  const executeRequested = isBlogExecuteModeRequested();
  const confirm = process.env[PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG];
  const dual = resolveDualBlogMongoEnv();

  const mode = resolveBlogMigrationMode({
    execute: executeRequested,
    confirm,
  });

  if (executeRequested && mode === "dry-run") {
    throw new ProductionBlogMigrationError(
      `Refusing write: set ${PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE} with --execute.`,
      "MISSING_CONFIRMATION",
    );
  }

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runProductionBlogMigration({
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
      r2Configured: isBlogMigrationR2Configured(),
    });

    const payload = {
      ...buildSafeBlogMigrationExecutionLog(report),
      dualConnectionEnv: {
        sourceUriEnv: BLOG_SOURCE_MONGODB_URI_ENV,
        sourceDatabaseEnv: BLOG_SOURCE_MONGODB_DATABASE_ENV,
        destinationUriEnv: BLOG_DESTINATION_MONGODB_URI_ENV,
        destinationDatabaseEnv: BLOG_DESTINATION_MONGODB_DATABASE_ENV,
      },
      confirmRequired: `${PRODUCTION_BLOG_MIGRATION_CONFIRM_FLAG}=${PRODUCTION_BLOG_MIGRATION_CONFIRM_VALUE}`,
      note:
        mode === "dry-run"
          ? "Dry-run only. Zero Mongo/R2 writes. Pass --execute with CONFIRM=YES for production write."
          : "Execute mode. Operator must not run against production without GO.",
    };
    const text = JSON.stringify(payload, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
    if (
      report.overallStatus === "FAILED" ||
      report.overallStatus === "RECOVERY_REQUIRED"
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
        tool: "execute-production-blog-migration",
        ok: false,
        error: safe,
      }),
    );
  } catch {
    console.error(
      JSON.stringify({
        tool: "execute-production-blog-migration",
        ok: false,
        error: "Blog migration execute failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
