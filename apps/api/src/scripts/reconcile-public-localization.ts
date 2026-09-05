/**
 * Pack 08K.1 / 08K.2.2 — historical PublicLocalizedPresentation reconciliation
 * + gated residual retry operator.
 *
 * Defaults to READ-ONLY dry-run. Shares discovery with diagnose:public-localization.
 *
 * Modes:
 *   (default)                         dry-run coverage + work-item report
 *   --explain-residuals               residual-only failure diagnostics (bounded memory)
 *   --explain-residuals-only          alias of --explain-residuals (Pack 08K.2.4)
 *   --retry-ready-residuals           residual-retry selection (dry-run unless --execute)
 *   --execute                         enqueue warms (requires staging gate)
 *   --wait-for-materialization        after execute, poll compact identities
 *   --timeout-ms=<n>                  wait timeout (default 300000)
 *
 * Pack 08K.2.4 / 08K.2.5 — --explain-residuals / --explain-residuals-only NEVER invoke full
 * corpus discovery/audit or civic snapshot hydrate. Use default dry-run (no explain)
 * for full corpus acceptance audit (still memory-heavy — documented debt).
 *
 * Pack 08K.2.5 — true residual selection (exclude CURRENT) + explicit identities:
 *   --residual sourceKind:sourceRecordId:locale   (repeatable; read-only; no prose)
 *
 * Pack 08K.2.6 — controlled one-attempt post-fix diagnostic retry:
 *   --retry-explicit-residuals-after-failure-reason-fix
 *   requires one or more --residual; no automatic discovery
 *   execute additionally requires --mongo + staging gates (same as residual retry)
 *
 * Full-corpus execute (--execute without --retry-ready-residuals) uses
 * uniquePresentationsRequiringWork. Residual execute uses ONLY
 * selectReadyPresentationsForResidualRetry — never falls back to full corpus.
 *
 * Residual execute requires ALL of:
 *   --mongo
 *   --execute
 *   --retry-ready-residuals  OR  --retry-explicit-residuals-after-failure-reason-fix
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true
 *   Mongo database name === humanity_union_staging
 *   PLATFORM_MODE is not production
 *
 * Usage (from apps/api):
 *   pnpm reconcile:public-localization -- --mongo
 *   pnpm reconcile:public-localization -- --mongo --explain-residuals
 *   pnpm reconcile:public-localization -- --mongo --retry-ready-residuals
 *   pnpm reconcile:public-localization -- --mongo \
 *     --retry-explicit-residuals-after-failure-reason-fix \
 *     --residual blog_post:blog-id:zh-Hant
 *   ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION=true \
 *     pnpm reconcile:public-localization -- --mongo --execute --retry-ready-residuals \
 *       --wait-for-materialization --timeout-ms=600000
 *
 * Never prints MONGODB_URI / passwords / API keys / translated bodies.
 * Do NOT run --execute against production. Cursor must not run --mongo/--execute.
 */

import { loadApiEnvironment } from "../config/load-api-environment.js";
import { bootstrapContentTranslationOperatorPersistence } from "../infrastructure/mongodb/bootstrap-content-translation-operator-persistence.js";
import { bootstrapContentTranslationResidualDiagnosticPersistence } from "../infrastructure/mongodb/bootstrap-content-translation-residual-diagnostic-persistence.js";
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
import { explainResidualsOnly, parseResidualIdentityArgs } from "../modules/language/public-localization-residual-only-diagnostic.js";
import {
  assertExplicitPostFixExecuteGuards,
  EXPLICIT_POST_FIX_RETRY_FLAG,
  runExplicitResidualsAfterFailureReasonFix,
} from "../modules/language/public-localization-explicit-post-fix-retry.js";
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
  return (
    process.argv.includes("--explain-residuals") ||
    process.argv.includes("--explain-residuals-only")
  );
}

function isRetryReadyResidualsRequested(): boolean {
  return process.argv.includes("--retry-ready-residuals");
}

function isRetryExplicitPostFixRequested(): boolean {
  return process.argv.includes(EXPLICIT_POST_FIX_RETRY_FLAG);
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
  readonly retryExplicitPostFix: boolean;
  readonly mongoFlag: boolean;
  readonly databaseName: string | null;
}): void {
  if (!input.execute) {
    return;
  }

  if (
    (input.retryReadyResiduals || input.retryExplicitPostFix) &&
    !input.mongoFlag
  ) {
    throw new Error(
      "Refusing residual retry execute: --mongo is required with --execute and residual retry flags.",
    );
  }

  if (input.retryExplicitPostFix) {
    assertExplicitPostFixExecuteGuards({
      mongoFlag: input.mongoFlag,
      execute: input.execute,
      databaseName: input.databaseName,
      allowFlag: process.env[ALLOW_FLAG],
      platformMode: process.env.PLATFORM_MODE,
      nodeEnv: process.env.NODE_ENV,
      stagingDatabase: STAGING_DATABASE,
      allowEnvName: ALLOW_FLAG,
    });
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
  const explainResiduals = isExplainResidualsRequested();
  const retryReadyResiduals = isRetryReadyResidualsRequested();
  const retryExplicitPostFix = isRetryExplicitPostFixRequested();
  const mongoFlag = isMongoFlagRequested();
  const kinds = parseKinds();
  const timeoutMs = parseTimeoutMs();
  const explicitIdentities = parseResidualIdentityArgs(process.argv);

  if (execute && explainResiduals) {
    throw new Error("--explain-residuals is READ-ONLY; omit --execute.");
  }

  if (retryExplicitPostFix && retryReadyResiduals) {
    throw new Error(
      "Choose either --retry-ready-residuals or --retry-explicit-residuals-after-failure-reason-fix.",
    );
  }

  if (!isMongoConfigured()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  const mongo = resolveMongoConfig();
  assertReconciliationGuards({
    execute,
    retryReadyResiduals,
    retryExplicitPostFix,
    mongoFlag,
    databaseName: mongo.database,
  });

  // Pack 08K.2.6 — explicit post-fix diagnostic retry (no full corpus).
  if (retryExplicitPostFix) {
    if (explicitIdentities.length === 0) {
      throw new Error(
        "--retry-explicit-residuals-after-failure-reason-fix requires one or more --residual identities.",
      );
    }
    const bootstrap = await bootstrapContentTranslationResidualDiagnosticPersistence();
    const plan = await runExplicitResidualsAfterFailureReasonFix({
      execute: false,
      postFixFlagEnabled: true,
      explicitIdentities,
    });
    console.log(
      JSON.stringify(
        {
          pack: "08K.2.6",
          operation: "retry_explicit_residuals_after_failure_reason_fix_selection",
          mode: "dry-run",
          database: mongo.database,
          persistenceBootstrap: bootstrap.mode,
          FULL_CORPUS_HYDRATED: plan.FULL_CORPUS_HYDRATED,
          SELECTED_IDENTITIES: plan.SELECTED_IDENTITIES,
          BLOCKED_IDENTITIES: plan.BLOCKED_IDENTITIES,
          SOURCE_RECORDS_LOADED: plan.SOURCE_RECORDS_LOADED,
          PEAK_IN_FLIGHT_IDENTITIES: plan.PEAK_IN_FLIGHT_IDENTITIES,
          WORKER_CONCURRENCY: plan.WORKER_CONCURRENCY,
          selectedIdentities: plan.selectedIdentities,
          blockedIdentities: plan.blockedIdentities,
          abortReason: plan.abortReason,
          note: plan.note,
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
      return;
    }

    const residual = await runExplicitResidualsAfterFailureReasonFix({
      execute: true,
      postFixFlagEnabled: true,
      explicitIdentities,
      waitForMaterialization,
      timeoutMs,
    });
    console.log(
      JSON.stringify(
        {
          pack: "08K.2.6",
          operation: "retry_explicit_residuals_after_failure_reason_fix",
          mode: "execute",
          database: mongo.database,
          FULL_CORPUS_HYDRATED: residual.FULL_CORPUS_HYDRATED,
          SELECTED_IDENTITIES: residual.SELECTED_IDENTITIES,
          BLOCKED_IDENTITIES: residual.BLOCKED_IDENTITIES,
          SOURCE_RECORDS_LOADED: residual.SOURCE_RECORDS_LOADED,
          PEAK_IN_FLIGHT_IDENTITIES: residual.PEAK_IN_FLIGHT_IDENTITIES,
          WORKER_CONCURRENCY: residual.WORKER_CONCURRENCY,
          presentationsScheduled: residual.presentationsScheduled,
          presentationsDeduped: residual.presentationsDeduped,
          presentationsFailed: residual.presentationsFailed,
          selectedIdentities: residual.selectedIdentities,
          blockedIdentities: residual.blockedIdentities,
          outcomes: residual.outcomes?.map((row) => ({
            sourceKind: row.sourceKind,
            sourceRecordId: row.sourceRecordId,
            targetLocale: row.targetLocale,
            outcome: row.outcome,
            ...(row.outcome === "TERMINAL_FAILED"
              ? {
                  failureMetadataVersion: row.failureMetadataVersion,
                  failureClass: row.failureClass,
                  failureReasonCode: row.failureReasonCode,
                  retryability: row.retryability,
                  latestAttemptAt: row.latestAttemptAt,
                  latestAttemptReason: row.latestAttemptReason,
                  latestAttemptTargetLocale: row.latestAttemptTargetLocale,
                  architectureRetryBasis: row.architectureRetryBasis,
                }
              : {}),
          })),
          note: residual.note,
        },
        null,
        2,
      ),
    );
    return;
  }

  // Pack 08K.2.4 — residual-only diagnostics: NO civic snapshot hydrate, NO full corpus audit.
  if (explainResiduals) {
    const bootstrap = await bootstrapContentTranslationResidualDiagnosticPersistence();
    const residualOnly = await explainResidualsOnly({
      ...(explicitIdentities.length ? { explicitIdentities } : {}),
    });
    console.log(
      JSON.stringify(
        {
          pack: "08K.2.5",
          operation: "explain_residuals_only",
          mode: residualOnly.mode,
          database: mongo.database,
          persistenceBootstrap: bootstrap.mode,
          RESIDUAL_DISCOVERY: residualOnly.RESIDUAL_DISCOVERY,
          FULL_CORPUS_HYDRATED: residualOnly.memory.FULL_CORPUS_HYDRATED,
          CANDIDATE_IDENTITIES_INSPECTED:
            residualOnly.memory.CANDIDATE_IDENTITIES_INSPECTED,
          RESIDUAL_IDENTITIES: residualOnly.memory.RESIDUAL_IDENTITIES,
          CURRENT_IDENTITIES_FILTERED:
            residualOnly.memory.CURRENT_IDENTITIES_FILTERED,
          DIAGNOSTIC_IDENTITIES: residualOnly.memory.DIAGNOSTIC_IDENTITIES,
          DIAGNOSTIC_BATCH_SIZE: residualOnly.memory.DIAGNOSTIC_BATCH_SIZE,
          OUTBOX_ROWS_INSPECTED: residualOnly.memory.OUTBOX_ROWS_INSPECTED,
          SOURCE_RECORDS_LOADED: residualOnly.memory.SOURCE_RECORDS_LOADED,
          TRANSLATION_ROWS_LOADED: residualOnly.memory.TRANSLATION_ROWS_LOADED,
          PEAK_IN_FLIGHT_IDENTITIES: residualOnly.memory.PEAK_IN_FLIGHT_IDENTITIES,
          RETRY_READY_IDENTITIES: residualOnly.RETRY_READY_IDENTITIES,
          RETRY_BLOCKED_IDENTITIES: residualOnly.RETRY_BLOCKED_IDENTITIES,
          residuals: residualOnly.residuals.map((row) => ({
            sourceKind: row.presentationIdentity.sourceKind,
            sourceRecordId: row.presentationIdentity.sourceRecordId,
            targetLocale: row.targetLocale,
            translationState: row.translationState,
            latestAttemptAt: row.latestAttemptAt,
            latestAttemptReason: row.latestAttemptReason,
            latestAttemptTargetLocale: row.latestAttemptTargetLocale,
            failureMetadataVersion: row.failureMetadataVersion,
            failureClass: row.failureClass,
            failureReasonCode: row.failureReasonCode,
            retryability: row.retryability,
            architectureRetryBasis: row.retryPreflight.architectureRetryBasis,
            mayScheduleNewWarm: row.mayScheduleNewWarm,
            ready: row.retryPreflight.ready,
            blockReason: row.retryPreflight.blockReason,
          })),
          note: residualOnly.note,
        },
        null,
        2,
      ),
    );
    return;
  }

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

  const residualReport = null;
  const residuals = null;
  const retrySelection = null;

  // Fresh post-audit after full-corpus execute+wait (Pack 08K.2.2 observability fix).
  // Pack 08K.2.4 — explain-residuals no longer runs on this path (early return above).
  const postAudit =
    execute
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
        pack: execute ? "08K.2.4" : "08K.2.4",
        operation: "reconcile_public_localization",
        mode: result.mode,
        explainResiduals: false,
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
            ? "DRY RUN full corpus audit — memory-heavy. Prefer --explain-residuals-only for residual failure diagnostics."
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
