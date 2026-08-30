/**
 * Blog Production Migration 02 — Read-only staging → production Blog preflight.
 *
 * Requires explicit dual Mongo env:
 *   PRODUCTION_BLOG_MIGRATION_SOURCE_URI / _DATABASE
 *   PRODUCTION_BLOG_MIGRATION_DESTINATION_URI / _DATABASE
 *
 * Optional R2 env (when unset, R2 verification is DEFERRED).
 * Never writes. Never --execute.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DualBucketBlogR2Inspector,
  PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE,
  assertBlogMigrationDestinationDatabase,
  assertBlogMigrationSourceDatabase,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  isBlogMigrationR2Configured,
  resolveDualBlogMongoEnv,
  resolveDualBlogR2Config,
  runProductionBlogMigrationPreflight,
} from "../modules/production-blog-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  assertNoWritePathRequested();

  const dual = resolveDualBlogMongoEnv();
  assertBlogMigrationSourceDatabase(dual.sourceDatabase);
  assertBlogMigrationDestinationDatabase(dual.destinationDatabase);

  if (dual.sourceDatabase !== PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE) {
    throw new Error(
      `Source database must be ${PRODUCTION_BLOG_MIGRATION_SOURCE_DATABASE}`,
    );
  }
  if (dual.destinationDatabase !== PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE) {
    throw new Error(
      `Destination database must be ${PRODUCTION_BLOG_MIGRATION_TARGET_DATABASE}`,
    );
  }

  const r2Configured = isBlogMigrationR2Configured();
  const r2Inspector = r2Configured
    ? new DualBucketBlogR2Inspector(resolveDualBlogR2Config())
    : null;

  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const report = await runProductionBlogMigrationPreflight({
      sourceDb: sourceClient.db(dual.sourceDatabase),
      destinationDb: destinationClient.db(dual.destinationDatabase),
      sourceDatabase: dual.sourceDatabase,
      destinationDatabase: dual.destinationDatabase,
      r2Configured,
      r2Inspector,
      mutationCounters: {
        mongoWrites: 0,
        putObjectCalls: 0,
        deleteObjectCalls: 0,
        emailSends: 0,
        outboxWrites: 0,
      },
    });

    const payload = {
      ...report,
      note:
        report.media.r2ObjectVerification === "DEFERRED"
          ? "Read-only Blog migration preflight. R2 verification DEFERRED (credentials unset). Never copies media or sends email."
          : "Read-only Blog migration preflight with dual-R2 HEAD verification. Never copies media or sends email.",
    };
    assertNoSecretLeak(JSON.stringify(payload));
    console.log(JSON.stringify(payload, null, 2));
    if (report.overallVerdict !== "PASS") {
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
  const text = JSON.stringify({
    tool: "preflight-production-blog-migration",
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
        tool: "preflight-production-blog-migration",
        ok: false,
        mode: "read-only",
        error: "Blog preflight failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
