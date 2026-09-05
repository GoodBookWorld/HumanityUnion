/**
 * Pack 08K.1 — historical PublicLocalizedPresentation reconciliation operator.
 *
 * Defaults to READ-ONLY dry-run. Shares discovery with diagnose:public-localization.
 *
 * Modes:
 *   (default)                         dry-run coverage + work-item report
 *   --execute                         enqueue warms (requires staging gate)
 *   --wait-for-materialization        after execute, poll compact identities
 *   --timeout-ms=<n>                  wait timeout (default 300000)
 *
 * Execute requires ALL of:
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true
 *   --execute
 *   Mongo database name === humanity_union_staging
 *   PLATFORM_MODE is not production
 *
 * Usage (from apps/api):
 *   pnpm reconcile:public-localization -- --mongo
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
 *     pnpm reconcile:public-localization -- --mongo --execute
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
 *     pnpm reconcile:public-localization -- --mongo --execute \
 *       --wait-for-materialization --timeout-ms=600000
 *
 * Never prints MONGODB_URI / passwords / API keys / translated bodies.
 * Do NOT run --execute against production. Cursor must not run --mongo/--execute.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapContentTranslationOperatorPersistence } from "../infrastructure/mongodb/bootstrap-content-translation-operator-persistence.js";
import {
  isMongoConfigured,
  resolveMongoConfig,
} from "../infrastructure/mongodb/mongo-config.js";
import { disconnectMongoClient } from "../infrastructure/mongodb/mongo-connection.js";
import {
  assertStagingWarmDiscoveryNotSilentlyEmpty,
  resolveStagingWarmDiscoveryExpectation,
  StagingContentTranslationDiscoveryFailure,
} from "../modules/language/content-translation-staging-warm-discovery-safety.js";
import {
  runPublicLocalizationReconciliation,
  waitForPublicLocalizationMaterialization,
} from "../modules/language/public-localization-reconciliation.js";
import type { StagingWarmSourceKind } from "../modules/language/content-translation-staging-warm-backfill.js";

loadApiEnvironment();

const STAGING_DATABASE = "humanity_union_staging";
const ALLOW_FLAG = "ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION";

function isExecuteModeRequested(): boolean {
  return process.argv.includes("--execute");
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

function assertReconciliationGuards(input: {
  readonly execute: boolean;
  readonly databaseName: string | null;
}): void {
  if (!input.execute) {
    return;
  }
  if (process.env[ALLOW_FLAG] !== "true") {
    throw new Error(
      `Refusing execute: set ${ALLOW_FLAG}=true to confirm staging public localization reconciliation.`,
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
  const nodeEnv = (process.env.NODE_ENV ?? "").trim().toLowerCase();
  if (nodeEnv === "production" && platformMode !== "staging") {
    throw new Error(
      "Refusing execute: NODE_ENV=production without PLATFORM_MODE=staging.",
    );
  }
}

async function main(): Promise<void> {
  const execute = isExecuteModeRequested();
  const waitForMaterialization = isWaitForMaterializationRequested();
  const kinds = parseKinds();
  const timeoutMs = parseTimeoutMs();
  const wantMongo = process.argv.includes("--mongo") || true;

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  // --mongo is the real-corpus path; keep flag for diagnose parity.
  void wantMongo;

  const mongo = resolveMongoConfig();
  assertReconciliationGuards({ execute, databaseName: mongo.database });

  const bootstrap = await bootstrapContentTranslationOperatorPersistence();
  const discoveryExpectation = resolveStagingWarmDiscoveryExpectation({
    databaseName: mongo.database,
  });

  const result = await runPublicLocalizationReconciliation({
    execute,
    kinds,
  });

  assertStagingWarmDiscoveryNotSilentlyEmpty({
    expectation: discoveryExpectation,
    discoveryByKind: result.audit.discoveryByKind,
    discoveryHint: result.audit.discoveryHint,
    localeTargetsAudited: result.audit.totals.TARGET_TRANSLATION_IDENTITIES,
  });

  if (result.audit.discoveryStatus === "FAILED") {
    throw new StagingContentTranslationDiscoveryFailure(
      "Public localization reconciliation discovery FAILED — refusing success report.",
      {
        SOURCE_RECORDS_DISCOVERED: result.audit.discoveryByKind.reduce(
          (sum, row) => sum + row.sourceRecordsDiscovered,
          0,
        ),
        PUBLIC_RECORDS: result.audit.discoveryByKind.reduce(
          (sum, row) => sum + row.publicRecords,
          0,
        ),
        ELIGIBLE_SOURCE_RECORDS: result.audit.candidates.length,
        LOCALE_TARGETS_AUDITED: result.audit.totals.TARGET_TRANSLATION_IDENTITIES,
        byKind: [...result.audit.discoveryByKind],
        discoveryHint: result.audit.discoveryHint,
      },
    );
  }

  let materialization: Awaited<
    ReturnType<typeof waitForPublicLocalizationMaterialization>
  > | null = null;

  if (execute && waitForMaterialization && result.audit.workItems.length > 0) {
    materialization = await waitForPublicLocalizationMaterialization({
      workItems: result.audit.workItems,
      timeoutMs,
      onProgress: (progress) => {
        console.log(
          JSON.stringify({
            pack: "08K.1",
            operation: "wait_for_materialization_progress",
            ...progress,
          }),
        );
      },
    });
  }

  const universalSuccessClaimed =
    result.audit.discoveryStatus === "COMPLETE" &&
    result.audit.totals.CANONICAL_FALLBACK_NODES === 0 &&
    result.audit.totals.WORK_ITEMS_REQUIRED === 0;

  console.log(
    JSON.stringify(
      {
        pack: "08K.1",
        operation: "reconcile_public_localization",
        mode: result.mode,
        database: mongo.database,
        persistenceBootstrap: bootstrap.mode,
        discoveryExpectation: discoveryExpectation.reason,
        DISCOVERY_STATUS: result.audit.discoveryStatus,
        discoveryHint: result.audit.discoveryHint,
        discoveryByKind: result.audit.discoveryByKind.map((row) => ({
          family: row.sourceKind,
          SOURCE_RECORDS_DISCOVERED: row.sourceRecordsDiscovered,
          PUBLIC_RECORDS: row.publicRecords,
        })),
        targetLocales: result.audit.targetLocales,
        schemaVersion: result.audit.schemaVersion,
        SOURCE_PRESENTATION_COUNT: result.audit.totals.SOURCE_PRESENTATION_COUNT,
        TARGET_TRANSLATION_IDENTITIES: result.audit.totals.TARGET_TRANSLATION_IDENTITIES,
        TOTAL_SEMANTIC_NODES: result.audit.totals.TOTAL_SEMANTIC_NODES,
        CURRENT_LOCALIZED_NODES: result.audit.totals.CURRENT_LOCALIZED_NODES,
        CANONICAL_FALLBACK_NODES: result.audit.totals.CANONICAL_FALLBACK_NODES,
        PRESENTATIONS_WITH_ANY_FALLBACK:
          result.audit.totals.PRESENTATIONS_WITH_ANY_FALLBACK,
        MISSING_TARGET_TRANSLATION_IDENTITIES:
          result.audit.totals.MISSING_TARGET_TRANSLATION_IDENTITIES,
        STALE_TARGET_TRANSLATION_IDENTITIES:
          result.audit.totals.STALE_TARGET_TRANSLATION_IDENTITIES,
        FAILED_TARGET_TRANSLATION_IDENTITIES:
          result.audit.totals.FAILED_TARGET_TRANSLATION_IDENTITIES,
        WORK_ITEMS_REQUIRED: result.audit.totals.WORK_ITEMS_REQUIRED,
        presentationsScheduled: result.presentationsScheduled,
        presentationsDeduped: result.presentationsDeduped,
        presentationsFailed: result.presentationsFailed,
        byFamily: result.audit.byFamily,
        byLocale: result.audit.byLocale,
        universalCorpusSuccessClaimed: universalSuccessClaimed,
        note:
          result.mode === "dry-run"
            ? "DRY RUN — zero provider calls, zero DB/outbox writes. Pass --execute with ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true on humanity_union_staging only."
            : "EXECUTE — enqueued presentation-level warms via bounded infrastructure. Materialization requires live outbox consumer.",
        materialization: materialization
          ? {
              timedOut: materialization.timedOut,
              elapsedMs: materialization.elapsedMs,
              ...materialization.progress,
            }
          : null,
      },
      null,
      2,
    ),
  );

  if (result.audit.discoveryStatus === "PARTIAL") {
    process.exitCode = 2;
  }
  if (materialization?.timedOut) {
    process.exitCode = 1;
  }
  if (
    materialization &&
    materialization.progress.TERMINAL_FAILED > 0 &&
    materialization.progress.CURRENT < materialization.progress.WORK_ITEMS_TOTAL
  ) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    if (error instanceof StagingContentTranslationDiscoveryFailure) {
      console.error(
        JSON.stringify({
          pack: "08K.1",
          operation: "reconcile_public_localization",
          fatal: true,
          code: error.code,
          message: error.message,
          diagnostics: error.diagnostics,
        }),
      );
    } else {
      console.error(
        JSON.stringify({
          pack: "08K.1",
          operation: "reconcile_public_localization",
          fatal: true,
          errorName: error instanceof Error ? error.name : "Error",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await disconnectMongoClient();
    } catch {
      // ignore disconnect errors
    }
    process.exit(process.exitCode ?? 0);
  });
