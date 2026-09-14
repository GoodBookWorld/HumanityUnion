/**
 * Blog Production Migration 04 — Read-only post-execute verifier.
 * Never writes. Never --execute.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DualBucketBlogR2CopyExecutor,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  isBlogMigrationR2Configured,
  resolveDualBlogMongoEnv,
  resolveDualBlogR2CopyConfig,
  runPostExecuteBlogMigrationVerification,
  runProductionBlogMigrationPreflight,
  DualBucketBlogR2Inspector,
  resolveDualBlogR2Config,
} from "../modules/production-blog-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  assertNoWritePathRequested();

  const dual = resolveDualBlogMongoEnv();
  const sourceClient = new MongoClient(dual.sourceUri);
  const destinationClient = new MongoClient(dual.destinationUri);
  await sourceClient.connect();
  await destinationClient.connect();
  try {
    const r2Configured = isBlogMigrationR2Configured();
    const r2Inspector = r2Configured
      ? new DualBucketBlogR2Inspector(resolveDualBlogR2Config())
      : null;
    const preflight = await runProductionBlogMigrationPreflight({
      sourceDb: sourceClient.db(dual.sourceDatabase),
      destinationDb: destinationClient.db(dual.destinationDatabase),
      sourceDatabase: dual.sourceDatabase,
      destinationDatabase: dual.destinationDatabase,
      r2Configured,
      r2Inspector,
    });

    if (!r2Configured) {
      throw new Error("Blog dual-R2 credentials required for post-execute verification.");
    }
    const mediaExecutor = new DualBucketBlogR2CopyExecutor(resolveDualBlogR2CopyConfig());
    const report = await runPostExecuteBlogMigrationVerification({
      sourceDb: sourceClient.db(dual.sourceDatabase),
      destinationDb: destinationClient.db(dual.destinationDatabase),
      mediaExecutor,
      expectedStorageKeys: preflight.media.uniqueStorageKeys,
    });

    const text = JSON.stringify(report, null, 2);
    assertNoSecretLeak(text);
    console.log(text);
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
  console.error(
    JSON.stringify({
      tool: "verify-production-blog-migration",
      ok: false,
      error: message,
    }),
  );
  process.exitCode = 1;
});
