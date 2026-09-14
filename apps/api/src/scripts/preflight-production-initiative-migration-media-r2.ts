/**
 * Task 07.4 — Read-only dual-R2 media preflight for production Initiative migration.
 *
 * Proves the reconciled unique public source objects are readable and classifies
 * destination keys before execute. Never PutObject / DeleteObject / Mongo writes.
 *
 * Requires:
 *   - staging Mongo (source inventory only; read-only)
 *   - dual source + destination R2 credentials/buckets
 *   - destination public base https://media.huws.org
 *
 * No --execute. Destination Mongo is not opened.
 */

import { MongoClient } from "mongodb";

import { loadApiEnvironment } from "../config/load-api-environment.js";
import {
  DualBucketR2MediaCopyExecutor,
  PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
  PRODUCTION_MEDIA_PUBLIC_BASE_URL,
  ProductionInitiativeMigrationError,
  SOURCE_MONGODB_DATABASE_ENV,
  SOURCE_MONGODB_URI_ENV,
  assertNoSecretLeak,
  assertNoWritePathRequested,
  loadReconciledPublicMediaPlanFromSource,
  resolveDualR2MediaCopyConfig,
  resolveSourceMongoEnvForMediaR2Preflight,
  runMediaR2Preflight,
} from "../modules/production-initiative-migration/index.js";

loadApiEnvironment();

async function main(): Promise<void> {
  assertNoWritePathRequested();

  const sourceMongo = resolveSourceMongoEnvForMediaR2Preflight();
  const r2Config = resolveDualR2MediaCopyConfig();
  if (r2Config.destinationPublicBaseUrl !== PRODUCTION_MEDIA_PUBLIC_BASE_URL) {
    throw new ProductionInitiativeMigrationError(
      `Destination public base must be ${PRODUCTION_MEDIA_PUBLIC_BASE_URL}.`,
      "WRONG_MEDIA_PUBLIC_BASE",
    );
  }

  const reader = new DualBucketR2MediaCopyExecutor(r2Config);
  const sourceClient = new MongoClient(sourceMongo.sourceUri);
  await sourceClient.connect();
  try {
    const sourceDb = sourceClient.db(sourceMongo.sourceDatabase);
    const loaded = await loadReconciledPublicMediaPlanFromSource(sourceDb);
    const report = await runMediaR2Preflight({
      planned: loaded.planned,
      reader,
      destinationPublicBaseUrl: r2Config.destinationPublicBaseUrl,
      mutationCounters: {
        putObjectCalls: reader.getWriteCount(),
        deleteObjectCalls: reader.getDeleteCount(),
        mongoWrites: 0,
        recoveryStoreWrites: 0,
      },
    });

    const payload = {
      ...report,
      reconciliation: {
        copyPublicReferenceCount: loaded.copyPublicReferenceCount,
        uniquePublicObjectCount: loaded.uniquePublicObjectCount,
      },
      requiredSourceDatabase: PRODUCTION_INITIATIVE_MIGRATION_SOURCE_DATABASE,
      sourceConnectionEnv: {
        sourceUriEnv: SOURCE_MONGODB_URI_ENV,
        sourceDatabaseEnv: SOURCE_MONGODB_DATABASE_ENV,
      },
      note: "Read-only dual-R2 preflight; destination Mongo was not opened; no R2 writes.",
    };
    assertNoSecretLeak(JSON.stringify(payload));
    console.log(JSON.stringify(payload, null, 2));
    if (report.verdict !== "PASS") {
      process.exitCode = 1;
    }
  } finally {
    await sourceClient.close();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const safe = message.replace(/[A-Za-z0-9+/_-]{24,}/g, "[redacted]");
  const text = JSON.stringify({
    tool: "preflight-production-initiative-migration-media-r2",
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
        tool: "preflight-production-initiative-migration-media-r2",
        ok: false,
        mode: "read-only",
        error: "Preflight failed (details redacted).",
      }),
    );
  }
  process.exitCode = 1;
});
