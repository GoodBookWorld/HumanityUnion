/**
 * Pack 08I.14B / 08I.14B.1 / 08I.14B.3 — STAGING-ONLY ContentTranslationWarm.
 *
 * Defaults to DRY RUN (no outbox writes).
 *
 * Modes:
 *   (default)           dry-run warm discovery/enqueue report
 *   --execute           enqueue warm for eligible public Initiative-path sources
 *   --repair            dry-run repair audit (MISSING/STALE only; skip CURRENT)
 *   --repair --execute  enqueue repair warms for MISSING/STALE only
 *   --wait-for-materialization
 *                       after execute/repair execute, poll until CURRENT or timeout
 *
 * Execute requires ALL of:
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true
 *   --execute
 *   Mongo database name === humanity_union_staging
 *   PLATFORM_MODE is not production
 *
 * Pack 08I.14B.1 — MUST bootstrap Mongo persistence before enumeration.
 * Pack 08I.14B.3 — enqueue is not materialization success; optional wait verifies CURRENT.
 *
 * Usage (from apps/api):
 *   pnpm warm:staging-content-translations
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --execute
 *   pnpm warm:staging-content-translations -- --repair
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --repair --execute
 *   ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true pnpm warm:staging-content-translations -- --repair --execute --wait-for-materialization --timeout-ms=600000
 *
 * Never prints MONGODB_URI / passwords / API keys / translated bodies.
 * Do NOT run execute/repair against production.
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
import {
  runStagingInitiativePathContentTranslationRepair,
  waitForStagingWarmMaterialization,
} from "../modules/language/content-translation-staging-warm-repair.js";

loadApiEnvironment();

const STAGING_DATABASE = "humanity_union_staging";
const ALLOW_FLAG = "ALLOW_STAGING_CONTENT_TRANSLATION_WARM";

function isExecuteModeRequested(): boolean {
  return process.argv.includes("--execute");
}

function isRepairModeRequested(): boolean {
  return process.argv.includes("--repair");
}

function isWaitForMaterializationRequested(): boolean {
  return process.argv.includes("--wait-for-materialization");
}

function parseTimeoutMs(): number {
  const match = process.argv.find((entry) => entry.startsWith("--timeout-ms="));
  if (!match) {
    return 300_000;
  }
  const parsed = Number.parseInt(match.slice("--timeout-ms=".length), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 300_000;
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
  const repair = isRepairModeRequested();
  const waitForMaterialization = isWaitForMaterializationRequested();
  const kinds = parseKinds();
  const timeoutMs = parseTimeoutMs();

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const mongo = resolveMongoConfig();
  assertStagingWarmGuards({ execute, databaseName: mongo.database });

  await bootstrapMongoPersistence();

  try {
    if (repair) {
      const result = await runStagingInitiativePathContentTranslationRepair({
        execute,
        kinds,
      });

      let materialization: Awaited<
        ReturnType<typeof waitForStagingWarmMaterialization>
      > | null = null;
      if (execute && waitForMaterialization && result.repairCandidates.length > 0) {
        materialization = await waitForStagingWarmMaterialization({
          candidates: result.repairCandidates,
          timeoutMs,
        });
      }

      console.log(
        JSON.stringify(
          {
            pack: "08I.14B.3",
            operation: "staging_content_translation_repair",
            mode: result.mode,
            database: mongo.database,
            kinds: kinds ?? [...STAGING_INITIATIVE_PATH_WARM_SOURCE_KINDS],
            totals: result.totals,
            byKindLocale: result.byKindLocale,
            repairCandidateCount: result.repairCandidates.length,
            materializationWait: materialization
              ? {
                  timedOut: materialization.timedOut,
                  elapsedMs: materialization.elapsedMs,
                  currentCount: materialization.currentCount,
                  remainingMissingOrStale: materialization.remainingMissingOrStale.length,
                }
              : null,
            note:
              result.mode === "dry-run"
                ? "DRY RUN — no outbox writes. CURRENT skipped. Re-run with ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true --repair --execute."
                : "EXECUTE — repair warms enqueued for MISSING/STALE only; CURRENT skipped. Enqueue ≠ materialization.",
          },
          null,
          2,
        ),
      );
      if (materialization?.timedOut) {
        process.exitCode = 2;
      }
      return;
    }

    const result = await runStagingInitiativePathContentTranslationWarm({
      execute,
      kinds,
    });

    let materialization: Awaited<ReturnType<typeof waitForStagingWarmMaterialization>> | null =
      null;
    if (execute && waitForMaterialization && result.candidates.length > 0) {
      materialization = await waitForStagingWarmMaterialization({
        candidates: result.candidates,
        timeoutMs,
      });
    }

    console.log(
      JSON.stringify(
        {
          pack: "08I.14B.3",
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
          materializationWait: materialization
            ? {
                timedOut: materialization.timedOut,
                elapsedMs: materialization.elapsedMs,
                currentCount: materialization.currentCount,
                remainingMissingOrStale: materialization.remainingMissingOrStale.length,
              }
            : null,
          note:
            result.mode === "dry-run"
              ? "DRY RUN — no outbox writes. Re-run with ALLOW_STAGING_CONTENT_TRANSLATION_WARM=true --execute."
              : "EXECUTE — warm requests enqueued; enqueue ≠ CURRENT materialization. Use --wait-for-materialization to verify.",
        },
        null,
        2,
      ),
    );
    if (materialization?.timedOut) {
      process.exitCode = 2;
    }
  } finally {
    await disconnectMongoClient().catch(() => undefined);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({ success: false, error: message }));
  process.exitCode = 1;
});
