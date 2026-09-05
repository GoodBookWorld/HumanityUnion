/**
 * Pack 08K.1 / 08K.2.2 — historical PublicLocalizedPresentation reconciliation
 * + gated residual retry operator.
 *
 * Defaults to READ-ONLY dry-run. Shares discovery with diagnose:public-localization.
 *
 * Modes:
 *   (default)                         dry-run coverage + work-item report
 *   --explain-residuals               dry-run + safe residual identity diagnostics
 *   --retry-ready-residuals           residual-retry selection (dry-run unless --execute)
 *   --execute                         enqueue warms (requires staging gate)
 *   --wait-for-materialization        after execute, poll compact identities
 *   --timeout-ms=<n>                  wait timeout (default 300000)
 *
 * Full-corpus execute (--execute without --retry-ready-residuals) uses
 * uniquePresentationsRequiringWork. Residual execute uses ONLY
 * selectReadyPresentationsForResidualRetry — never falls back to full corpus.
 *
 * Residual execute requires ALL of:
 *   --mongo
 *   --execute
 *   --retry-ready-residuals
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true
 *   Mongo database name === humanity_union_staging
 *   PLATFORM_MODE is not production
 *
 * Usage (from apps/api):
 *   pnpm reconcile:public-localization -- --mongo
 *   pnpm reconcile:public-localization -- --mongo --explain-residuals
 *   pnpm reconcile:public-localization -- --mongo --retry-ready-residuals
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
 *     pnpm reconcile:public-localization -- --mongo --execute --retry-ready-residuals \
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
import {
  auditPublicLocalizationCorpusPostRetry,
  runPublicLocalizationResidualRetry,
} from "../modules/language/public-localization-residual-retry.js";
import { explainPublicLocalizationResidualsWithPreflight } from "../modules/language/public-localization-retry-preflight.js";
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

function isExplainResidualsRequested(): boolean {
  return process.argv.includes("--explain-residuals");
}

function isRetryReadyResidualsRequested(): boolean {
  return process.argv.includes("--retry-ready-residuals");
}

function isMongoFlagRequested(): boolean {
  return process.argv.includes("--mongo");
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
  readonly retryReadyResiduals: boolean;
  readonly mongoFlag: boolean;
  readonly databaseName: string | null;
}): void {
  if (!input.execute) {
    return;
  }

  if (input.retryReadyResiduals && !input.mongoFlag) {
    throw new Error(
      "Refusing residual retry execute: --mongo is required with --execute --retry-ready-residuals.",
    );
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
  const explainResiduals = isExplainResidualsRequested();
  const retryReadyResiduals = isRetryReadyResidualsRequested();
  const mongoFlag = isMongoFlagRequested();
  const kinds = parseKinds();
  const timeoutMs = parseTimeoutMs();

  if (execute && explainResiduals) {
    throw new Error("--explain-residuals is READ-ONLY; omit --execute.");
  }

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const mongo = resolveMongoConfig();
  assertReconciliationGuards({
    execute,
    retryReadyResiduals,
    mongoFlag,
    databaseName: mongo.database,
  });

  const bootstrap = await bootstrapContentTranslationOperatorPersistence();
  const discoveryExpectation = resolveStagingWarmDiscoveryExpectation({
    databaseName: mongo.database,
  });

  // Pack 08K.2.2 — residual path never uses full-corpus enqueue selection.
  if (retryReadyResiduals) {
    // Phase 1: non-mutating selection (ALWAYS before any enqueue).
    const plan = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds,
    });

    assertStagingWarmDiscoveryNotSilentlyEmpty({
      expectation: discoveryExpectation,
      discoveryByKind: plan.preAudit.discoveryByKind,
      discoveryHint: plan.preAudit.discoveryHint,
      localeTargetsAudited: plan.preAudit.totals.TARGET_TRANSLATION_IDENTITIES,
    });

    if (plan.preAudit.discoveryStatus === "FAILED") {
      throw new StagingContentTranslationDiscoveryFailure(
        "Public localization residual retry discovery FAILED — refusing success report.",
        {
          SOURCE_RECORDS_DISCOVERED: plan.preAudit.discoveryByKind.reduce(
            (sum, row) => sum + row.sourceRecordsDiscovered,
            0,
          ),
          PUBLIC_RECORDS: plan.preAudit.discoveryByKind.reduce(
            (sum, row) => sum + row.publicRecords,
            0,
          ),
          ELIGIBLE_SOURCE_RECORDS: plan.preAudit.candidates.length,
          LOCALE_TARGETS_AUDITED: plan.preAudit.totals.TARGET_TRANSLATION_IDENTITIES,
          byKind: [...plan.preAudit.discoveryByKind],
          discoveryHint: plan.preAudit.discoveryHint,
        },
      );
    }

    console.log(
      JSON.stringify(
        {
          pack: "08K.2.2",
          operation: "retry_ready_residuals_selection",
          mode: "dry-run",
          RETRY_READY_IDENTITIES: plan.RETRY_READY_IDENTITIES,
          RETRY_BLOCKED_IDENTITIES: plan.RETRY_BLOCKED_IDENTITIES,
          RETRY_SELECTED_IDENTITIES: plan.RETRY_SELECTED_IDENTITIES,
          presentationsToEnqueue: plan.presentationsToEnqueue,
          presentationGroupingExplained: plan.presentationGroupingExplained,
          selectedIdentities: plan.selectedIdentities,
          blockedIdentities: plan.blockedIdentities,
          abortReason: plan.abortReason,
          note: "Selection before mutation — zero provider calls, zero DB/outbox writes.",
        },
        null,
        2,
      ),
    );

    if (plan.abortReason) {
      process.exitCode = 1;
      return;
    }

    if (!execute) {
      console.log(
        JSON.stringify(
          {
            pack: "08K.2.2",
            operation: "retry_ready_residuals",
            mode: "dry-run",
            database: mongo.database,
            persistenceBootstrap: bootstrap.mode,
            DISCOVERY_STATUS: plan.preAudit.discoveryStatus,
            PRE_TOTAL_SEMANTIC_NODES: plan.preAudit.totals.TOTAL_SEMANTIC_NODES,
            PRE_CURRENT_LOCALIZED_NODES: plan.preAudit.totals.CURRENT_LOCALIZED_NODES,
            PRE_CANONICAL_FALLBACK_NODES: plan.preAudit.totals.CANONICAL_FALLBACK_NODES,
            PRE_WORK_ITEMS_REQUIRED: plan.preAudit.totals.WORK_ITEMS_REQUIRED,
            RETRY_READY_IDENTITIES: plan.RETRY_READY_IDENTITIES,
            RETRY_BLOCKED_IDENTITIES: plan.RETRY_BLOCKED_IDENTITIES,
            RETRY_SELECTED_IDENTITIES: plan.RETRY_SELECTED_IDENTITIES,
            presentationsScheduled: 0,
            materialization: null,
            POST_TOTAL_SEMANTIC_NODES: null,
            POST_CURRENT_LOCALIZED_NODES: null,
            POST_CANONICAL_FALLBACK_NODES: null,
            POST_WORK_ITEMS_REQUIRED: null,
            POST_RETRY_READY_IDENTITIES: null,
            POST_RETRY_BLOCKED_IDENTITIES: null,
            universalCorpusSuccessClaimed: false,
            note: "DRY RUN — selection only. Pass --execute with all staging gates to enqueue.",
          },
          null,
          2,
        ),
      );
      if (plan.preAudit.discoveryStatus === "PARTIAL") {
        process.exitCode = 2;
      }
      return;
    }

    // Phase 2: recompute preflight immediately before enqueue (execute gates already passed).
    const residual = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds,
    });

    if (residual.abortReason) {
      console.log(
        JSON.stringify({
          pack: "08K.2.2",
          operation: "retry_ready_residuals",
          mode: "execute",
          fatal: true,
          abortReason: residual.abortReason,
          RETRY_READY_IDENTITIES: residual.RETRY_READY_IDENTITIES,
          RETRY_BLOCKED_IDENTITIES: residual.RETRY_BLOCKED_IDENTITIES,
          RETRY_SELECTED_IDENTITIES: residual.RETRY_SELECTED_IDENTITIES,
        }),
      );
      process.exitCode = 1;
      return;
    }

    let materialization: Awaited<
      ReturnType<typeof waitForPublicLocalizationMaterialization>
    > | null = null;

    if (waitForMaterialization && residual.selectedWorkItems.length > 0) {
      materialization = await waitForPublicLocalizationMaterialization({
        workItems: residual.selectedWorkItems,
        timeoutMs,
        onProgress: (progress) => {
          console.log(
            JSON.stringify({
              pack: "08K.2.2",
              operation: "wait_for_materialization_progress",
              ...progress,
            }),
          );
        },
      });
    }

    // Fresh post-audit — never reuse pre-execution CURRENT/fallback snapshot.
    const postAudit = await auditPublicLocalizationCorpusPostRetry({ kinds });
    const postResidualSelection = await explainPublicLocalizationResidualsWithPreflight({
      workItems: postAudit.workItems,
    });

    const postUniversalSuccess =
      postAudit.discoveryStatus === "COMPLETE" &&
      postAudit.totals.CANONICAL_FALLBACK_NODES === 0 &&
      postAudit.totals.WORK_ITEMS_REQUIRED === 0 &&
      postAudit.totals.CURRENT_LOCALIZED_NODES === postAudit.totals.TOTAL_SEMANTIC_NODES;

    console.log(
      JSON.stringify(
        {
          pack: "08K.2.2",
          operation: "retry_ready_residuals",
          mode: "execute",
          database: mongo.database,
          persistenceBootstrap: bootstrap.mode,
          discoveryExpectation: discoveryExpectation.reason,
          DISCOVERY_STATUS: residual.preAudit.discoveryStatus,
          PRE_TOTAL_SEMANTIC_NODES: residual.preAudit.totals.TOTAL_SEMANTIC_NODES,
          PRE_CURRENT_LOCALIZED_NODES: residual.preAudit.totals.CURRENT_LOCALIZED_NODES,
          PRE_CANONICAL_FALLBACK_NODES: residual.preAudit.totals.CANONICAL_FALLBACK_NODES,
          PRE_WORK_ITEMS_REQUIRED: residual.preAudit.totals.WORK_ITEMS_REQUIRED,
          RETRY_READY_IDENTITIES: residual.RETRY_READY_IDENTITIES,
          RETRY_BLOCKED_IDENTITIES: residual.RETRY_BLOCKED_IDENTITIES,
          RETRY_SELECTED_IDENTITIES: residual.RETRY_SELECTED_IDENTITIES,
          presentationsScheduled: residual.presentationsScheduled,
          presentationsDeduped: residual.presentationsDeduped,
          presentationsFailed: residual.presentationsFailed,
          materialization: materialization
            ? {
                timedOut: materialization.timedOut,
                elapsedMs: materialization.elapsedMs,
                WORK_ITEMS_TOTAL: materialization.progress.WORK_ITEMS_TOTAL,
                CURRENT: materialization.progress.CURRENT,
                QUEUED: materialization.progress.QUEUED,
                PROCESSING: materialization.progress.PROCESSING,
                RETRYING: materialization.progress.RETRYING,
                TERMINAL_FAILED: materialization.progress.TERMINAL_FAILED,
                MISSING_AFTER_DISPATCH: materialization.progress.MISSING_AFTER_DISPATCH,
                MISSING: materialization.progress.MISSING,
                TIMED_OUT: materialization.progress.TIMED_OUT,
              }
            : null,
          POST_TOTAL_SEMANTIC_NODES: postAudit.totals.TOTAL_SEMANTIC_NODES,
          POST_CURRENT_LOCALIZED_NODES: postAudit.totals.CURRENT_LOCALIZED_NODES,
          POST_CANONICAL_FALLBACK_NODES: postAudit.totals.CANONICAL_FALLBACK_NODES,
          POST_WORK_ITEMS_REQUIRED: postAudit.totals.WORK_ITEMS_REQUIRED,
          POST_RETRY_READY_IDENTITIES:
            postResidualSelection.selection.RETRY_READY_IDENTITIES,
          POST_RETRY_BLOCKED_IDENTITIES:
            postResidualSelection.selection.RETRY_BLOCKED_IDENTITIES,
          universalCorpusSuccessClaimed: postUniversalSuccess,
          note:
            "EXECUTE complete — POST_* counters are a fresh corpus audit (not the pre-execution snapshot).",
        },
        null,
        2,
      ),
    );

    if (residual.preAudit.discoveryStatus === "PARTIAL") {
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
    return;
  }

  // --- Full-corpus reconciliation path (Pack 08K.1) ---
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
            pack: "08K.2",
            operation: "wait_for_materialization_progress",
            ...progress,
          }),
        );
      },
    });
  }

  const residualReport = explainResiduals
    ? await explainPublicLocalizationResidualsWithPreflight({
        workItems: result.audit.workItems,
      })
    : null;

  const residuals = residualReport?.residuals ?? null;
  const retrySelection = residualReport
    ? {
        RETRY_READY_IDENTITIES: residualReport.selection.RETRY_READY_IDENTITIES,
        RETRY_BLOCKED_IDENTITIES: residualReport.selection.RETRY_BLOCKED_IDENTITIES,
        byFamilyReady: residualReport.selection.byFamilyReady,
        byLocaleReady: residualReport.selection.byLocaleReady,
        readyIdentities: residualReport.selection.ready.map((row) => ({
          family: row.family,
          sourceRecordId: row.presentationIdentity.sourceRecordId,
          targetLocale: row.targetLocale,
          architectureRetryBasis: row.retryPreflight.architectureRetryBasis,
          failureReasonCode: row.failureReasonCode,
        })),
        blockedIdentities: residualReport.selection.blocked.map((row) => ({
          family: row.family,
          sourceRecordId: row.presentationIdentity.sourceRecordId,
          targetLocale: row.targetLocale,
          blockReason: row.retryPreflight.blockReason,
          failureReasonCode: row.failureReasonCode,
        })),
      }
    : null;

  // Fresh post-audit after full-corpus execute+wait (Pack 08K.2.2 observability fix).
  const postAudit =
    execute && !explainResiduals
      ? await auditPublicLocalizationCorpusPostRetry({ kinds })
      : null;

  const universalSuccessClaimed =
    postAudit !== null
      ? postAudit.discoveryStatus === "COMPLETE" &&
        postAudit.totals.CANONICAL_FALLBACK_NODES === 0 &&
        postAudit.totals.WORK_ITEMS_REQUIRED === 0 &&
        postAudit.totals.CURRENT_LOCALIZED_NODES ===
          postAudit.totals.TOTAL_SEMANTIC_NODES
      : result.audit.discoveryStatus === "COMPLETE" &&
        result.audit.totals.CANONICAL_FALLBACK_NODES === 0 &&
        result.audit.totals.WORK_ITEMS_REQUIRED === 0;

  console.log(
    JSON.stringify(
      {
        pack: execute ? "08K.2.2" : "08K.2.1",
        operation: "reconcile_public_localization",
        mode: result.mode,
        explainResiduals,
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
        residuals,
        retrySelection,
        POST_TOTAL_SEMANTIC_NODES: postAudit?.totals.TOTAL_SEMANTIC_NODES ?? null,
        POST_CURRENT_LOCALIZED_NODES: postAudit?.totals.CURRENT_LOCALIZED_NODES ?? null,
        POST_CANONICAL_FALLBACK_NODES: postAudit?.totals.CANONICAL_FALLBACK_NODES ?? null,
        POST_WORK_ITEMS_REQUIRED: postAudit?.totals.WORK_ITEMS_REQUIRED ?? null,
        universalCorpusSuccessClaimed: universalSuccessClaimed,
        note:
          result.mode === "dry-run"
            ? explainResiduals
              ? "EXPLAIN RESIDUALS — read-only. Identities/counts/failureClass only; no source/translated bodies."
              : "DRY RUN — zero provider calls, zero DB/outbox writes. Pass --explain-residuals or --retry-ready-residuals."
            : postAudit
              ? "EXECUTE — POST_* is a fresh corpus audit after enqueue/wait."
              : "EXECUTE — enqueued presentation-level warms via bounded infrastructure.",
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
          pack: "08K.2.2",
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
          pack: "08K.2.2",
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
