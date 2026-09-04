/**
 * Pack 08I.14B / 08I.14B.1 — STAGING-ONLY ContentTranslationWarm backfill.
 *
 * Defaults to DRY RUN (no outbox writes).
 *
 * Execute requires ALL of:
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true
 *   --execute
 *   Mongo database name === humanity_union_staging
 *   PLATFORM_MODE is not production
 *
 * Pack 08I.14B.1 — MUST bootstrap Mongo persistence (hydrate + sync stores)
 * before enumeration. Connecting alone leaves Initiative/Analysis in-memory
 * maps empty and yields candidates=0.
 *
 * Usage (from apps/api):
 *   pnpm warm:staging-content-translations
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --execute
 *
 * Never prints MONGODB_URI / passwords / API keys / translated bodies.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapMongoPersistence } from "../infrastructure/mongodb/bootstrap-mongo-persistence.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import {
  runStagingInitiativePathContentTranslationWarm,
  type StagingWarmSourceKind,
  STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS,
} from "../modules/language/content-translation-staging-warm-backfill.js";

loadApiEnvironment();

const STAGING_DATABASE = "humanity_union_staging";
const ALLOW_FLAG = "ALLOW_STAGING_CONTENT_TRANSLATION_WARM";

function isExecuteModeRequested(): boolean {
  return process.argv.includes("--execute");
}

function parseKinds(): StagingWarmSourceKind[] | undefined {
  const match = process.argv.find((entry) => entry.startsWith("--kinds="));
  if (!match) {
    return undefined;
  }
  const raw = match.slice("--kinds=".length);
  const kinds = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean) as StagingWarmSourceKind[];
  return kinds.length ? kinds : undefined;
}

function assertStagingWarmGuards(input: {
  readonly execute: boolean;
  readonly databaseName: string | null;
}): void {
  if (!input.execute) {
    return;
  }
  if (process.env[ALLOW_FLAG] !== "true") {
    throw new Error(
      `Refusing execute: set ${ALLOW_FLAG}=true to confirm staging warm.`,
    );
  }
  if (input.databaseName !== STAGING_DATABASE) {
    throw new Error(
      `Refusing execute: database must be ${STAGING_DATABASE} (got ${input.databaseName ?? "unset"}).`,
    );
  }
  const platformMode = (process.env.PLATFORM_MODE ?? "").trim().toLowerCase();
  if (platformMode === "production") {
    throw new Error("Refusing execute: PLATFORM_MODE=production is not allowed.");
  }
}

async function main(): Promise<void> {
  const execute = isExecuteModeRequested();
  const kinds = parseKinds();

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const mongo = resolveMongoConfig();
  assertStagingWarmGuards({ execute, databaseName: mongo.database });

  // Pack 08I.14B.1 — hydrate Mongo snapshot caches + sync Initiative/Analysis
  // in-memory stores (same path as live API boot). connectMongoClient alone is
  // insufficient and produced SOURCE_RECORDS_DISCOVERED=0 on staging.
  await bootstrapMongoPersistence();

  try {
    const result = await runStagingInitiativePathContentTranslationWarm({
      execute,
      kinds,
    });

    console.log(
      JSON.stringify(
        {
          pack: "08I.14B.1",
          operation: "staging_content_translation_warm",
          mode: result.mode,
          database: mongo.database,
          kinds: kinds ?? [...STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS],
          persistenceBootstrap: "bootstrapMongoPersistence",
          discoveryHint: result.discoveryHint,
          totals: {
            SOURCE_RECORDS_DISCOVERED: result.totals.sourceRecordsDiscovered,
            PUBLIC_RECORDS: result.totals.publicRecords,
            ELIGIBLE_SOURCE_RECORDS: result.totals.eligibleSourceRecords,
            WARM_REQUEST_CANDIDATES: result.totals.warmRequestCandidates,
            SCHEDULED: result.totals.scheduled,
            skippedCurrentOrIneligible: result.totals.skippedCurrentOrIneligible,
            deduped: result.totals.deduped,
            failed: result.totals.failed,
          },
          byKind: result.discoveryByKind.map((row) => ({
            sourceKind: row.sourceKind,
            SOURCE_RECORDS_DISCOVERED: row.sourceRecordsDiscovered,
            PUBLIC_RECORDS: row.publicRecords,
            ELIGIBLE_SOURCE_RECORDS: row.eligibleSourceRecords,
            WARM_REQUEST_CANDIDATES: row.warmRequestCandidates,
            SCHEDULED: row.scheduled,
            skippedCurrentOrIneligible: row.skippedCurrentOrIneligible,
            deduped: row.deduped,
            failed: row.failed,
          })),
          note:
            result.mode === "dry-run"
              ? "DRY RUN — no outbox writes. Re-run with ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true --execute."
              : "EXECUTE — warm requests enqueued; consumer skips current translations.",
        },
        null,
        2,
      ),
    );
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message }));
  process.exitCode = 1;
});
