/**
 * Pack 08K.2.2 — gated residual localization retry operator.
 * Deterministic only — no live Gemini / no staging Mongo mutation.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, it } from "node:test";

process.env.INITIATIVE_PERSISTENCE = "memory";
process.env.CONTENT_TRANSLATION_PERSISTENCE = "memory";
process.env.TRANSLATION_PROVIDER = "deterministic";
process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
process.env.LANGUAGE_REGISTRY_PERSISTENCE = "memory";

import type { Initiative } from "@hu/types";

import {
  auditPublicLocalizationCorpusPostRetry,
  encodeContentTranslationFailureMetadata,
  ensureLanguageRegistrySeeded,
  enqueueContentTranslationWarmRequested,
  getContentTranslationWorkerPeakConcurrencyForTests,
  listContentTranslationWarmMemoryPendingForTests,
  markContentTranslationWarmMemoryFailedForTests,
  peekContentTranslationWarmOutboxFailure,
  processContentTranslationWarmRequested,
  resetContentTranslationMemoryStoreForTests,
  resetContentTranslationWarmMemoryForTests,
  resetContentTranslationWorkerConcurrencyForTests,
  resetLanguageRegistryStoreForTests,
  resetTranslationProviderForTests,
  resolveContentTranslationWorkerConcurrency,
  runPublicLocalizationResidualRetry,
  selectReadyPresentationsForResidualRetry,
  setContentTranslationWarmForceMemoryForTests,
  setLanguageRegistryForceMemoryForTests,
  updateLanguageRegistryRecord,
  waitForPublicLocalizationMaterialization,
} from "../../../src/modules/language/index.js";
import { upsertContentTranslation } from "../../../src/modules/language/persistence/content-translation.repository.js";
import {
  createInitiative,
  deleteInitiative,
} from "../../../src/modules/initiatives/initiative.store.js";
import { loadTranslatableSource } from "../../../src/modules/language/content-translation.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, "../../..");

function readApi(rel: string): string {
  return readFileSync(join(apiRoot, rel), "utf8");
}

function sampleInitiative(suffix: string): Initiative {
  const now = new Date().toISOString();
  return {
    initiativeId: `initiative-pack08k22-${suffix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    stewardId: "member-pack08k22",
    createdAt: now,
    updatedAt: now,
    title: `Pack08K22 Initiative ${suffix}`,
    description: `Canonical English prose for residual retry ${suffix}.`,
    status: "proposal",
    lifecyclePhase: "projected",
    visibility: { policy: "public" },
    metadata: {
      category: "Community",
      tags: [],
      region: "Test",
      language: "en",
      communitySlug: "test",
      activityArea: "Environment",
    },
    revisions: [],
    contributions: [],
    timeline: [],
  };
}

describe("Pack 08K.2.2 — gated residual retry", () => {
  const createdInitiativeIds: string[] = [];

  beforeEach(async () => {
    resetContentTranslationMemoryStoreForTests();
    resetContentTranslationWarmMemoryForTests();
    resetLanguageRegistryStoreForTests();
    resetTranslationProviderForTests();
    resetContentTranslationWorkerConcurrencyForTests();
    setLanguageRegistryForceMemoryForTests(true);
    setContentTranslationWarmForceMemoryForTests(true);
    await ensureLanguageRegistrySeeded();
    for (const locale of ["uk", "zh-Hant", "ar"] as const) {
      await updateLanguageRegistryRecord(`lang-${locale}`, {
        enabled: true,
        contentTranslationEnabled: true,
      });
    }
  });

  afterEach(() => {
    for (const id of createdInitiativeIds.splice(0)) {
      try {
        deleteInitiative(id);
      } catch {
        // ignore
      }
    }
    setContentTranslationWarmForceMemoryForTests(false);
    setLanguageRegistryForceMemoryForTests(false);
  });

  it("only retry-ready identities selected; blocked never scheduled", async () => {
    const readyInit = sampleInitiative("ready");
    const blockedInit = sampleInitiative("blocked");
    createInitiative(readyInit);
    createInitiative(blockedInit);
    createdInitiativeIds.push(readyInit.initiativeId, blockedInit.initiativeId);

    const failed = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: blockedInit.initiativeId,
      reason: "operator_backfill",
    });
    assert.ok(failed.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      failed.eventId,
      encodeContentTranslationFailureMetadata({
        schema: "content_translation_failure_meta_v1",
        validationContractVersion: "v1",
        failureClass: "VALIDATION_FAILED",
        failureReasonCode: "UNCHANGED_CIVIC_TITLE",
        sourceKind: "initiative",
        sourceRecordId: blockedInit.initiativeId,
        sourceVersion: "v1",
        targetLocale: "uk",
        failedAt: new Date().toISOString(),
        retryabilityHint: "non_retryable_until_code_or_content_change",
      }),
    );

    const result = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds: ["initiative"],
      deps: {
        listInitiatives: () => [readyInit, blockedInit],
      },
      targetLocales: ["uk"],
    });

    assert.ok(result.RETRY_READY_IDENTITIES >= 1);
    assert.ok(result.RETRY_BLOCKED_IDENTITIES >= 1);
    assert.equal(result.RETRY_SELECTED_IDENTITIES, result.RETRY_READY_IDENTITIES);
    assert.ok(
      result.selectedIdentities.every(
        (row) => row.sourceRecordId !== blockedInit.initiativeId,
      ),
    );
    assert.ok(
      result.blockedIdentities.some(
        (row) => row.sourceRecordId === blockedInit.initiativeId,
      ),
    );
    assert.equal(result.presentationsScheduled, 0);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("locale precision preserved — non-selected locale not in warm targetLocales", async () => {
    const initiative = sampleInitiative("locale");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);

    // CURRENT for ar — must not be overwritten / must not be selected.
    await upsertContentTranslation({
      translationId: "tr-ar-08k22",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "ar",
      translatedContent: { title: "[ar] T", description: "[ar] D" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });

    const dry = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk", "ar", "zh-Hant"],
    });

    assert.ok(dry.selectedIdentities.some((row) => row.targetLocale === "uk"));
    assert.ok(!dry.selectedIdentities.some((row) => row.targetLocale === "ar"));

    const schedule = selectReadyPresentationsForResidualRetry(dry.selection);
    const unit = schedule.find((row) => row.sourceRecordId === initiative.initiativeId);
    assert.ok(unit);
    assert.ok(unit.targetLocales.includes("uk"));
    assert.ok(!unit.targetLocales.includes("ar"));

    const executed = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk", "ar", "zh-Hant"],
    });
    assert.equal(executed.abortReason, null);
    assert.ok(executed.presentationsScheduled >= 1);

    const pending = listContentTranslationWarmMemoryPendingForTests();
    const cmd = pending.find(
      (row) => row.command.sourceRecordId === initiative.initiativeId,
    );
    assert.ok(cmd);
    assert.deepEqual(
      [...(cmd.command.targetLocales ?? [])].sort(),
      [...unit.targetLocales].sort(),
    );
    assert.ok(!(cmd.command.targetLocales ?? []).includes("ar"));

    const warm = await processContentTranslationWarmRequested(cmd.command);
    assert.ok(warm.locales.every((locale) => locale.targetLanguage !== "ar" || locale.status === "skipped_existing"));
    assert.ok(warm.locales.some((locale) => locale.targetLanguage === "uk"));
    assert.ok(!warm.locales.some((locale) => locale.targetLanguage === "ar"));

    // CURRENT ar unchanged
    const { findContentTranslation } = await import(
      "../../../src/modules/language/persistence/content-translation.repository.js"
    );
    const arRow = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "ar",
    });
    assert.equal(arRow?.translatedContent?.title, "[ar] T");
  });

  it("CURRENT never provider-called/overwritten on residual warm", async () => {
    const initiative = sampleInitiative("current-protect");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);

    await upsertContentTranslation({
      translationId: "tr-uk-current-08k22",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      sourceLanguage: "en",
      targetLanguage: "uk",
      translatedContent: { title: "[uk] KEEP", description: "[uk] KEEP" },
      translationProvider: "deterministic",
      translationKind: "machine",
      createdAt: new Date().toISOString(),
      stale: false,
      freshness: "current",
    });

    const result = await processContentTranslationWarmRequested({
      commandName: "ContentTranslationWarmRequested",
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      requestedAt: new Date().toISOString(),
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.equal(result.locales[0]?.status, "skipped_existing");

    const { findContentTranslation } = await import(
      "../../../src/modules/language/persistence/content-translation.repository.js"
    );
    const row = await findContentTranslation({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      sourceVersion: source.sourceVersion,
      targetLanguage: "uk",
    });
    assert.equal(row?.translatedContent?.title, "[uk] KEEP");
  });

  it("missing safety gate script contract => zero writes; production refused", () => {
    const script = readApi("src/scripts/reconcile-public-localization.ts");
    assert.match(script, /--retry-ready-residuals/);
    assert.match(script, /runPublicLocalizationResidualRetry/);
    assert.match(script, /ALLOW_STAGING_PUBLIC_LOCALIZATION_RECONCILIATION/);
    assert.match(script, /humanity_union_staging/);
    assert.match(script, /PLATFORM_MODE=production is not allowed/);
    assert.match(script, /--mongo is required with --execute --retry-ready-residuals/);
    assert.match(script, /residual path never uses full-corpus enqueue selection/);
    assert.doesNotMatch(script, /production-admin-source\.json/);
  });

  it("worker concurrency remains bounded default 1", () => {
    delete process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY;
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    process.env.CONTENT_TRANSLATION_WORKER_CONCURRENCY = "1";
    assert.equal(resolveContentTranslationWorkerConcurrency(), 1);
    assert.ok(getContentTranslationWorkerPeakConcurrencyForTests() <= 1);
  });

  it("terminal legacy retry uses approved basis only", async () => {
    const initiative = sampleInitiative("legacy-basis");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_backfill",
    });
    assert.ok(enqueued.eventId);
    markContentTranslationWarmMemoryFailedForTests(
      enqueued.eventId,
      "One or more automatic warm locale translations failed without CURRENT materialization.",
    );

    // Historical failed outbox peek preserved (not globally cleared by plan).
    const peekBefore = await peekContentTranslationWarmOutboxFailure({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.equal(peekBefore.disposition, "failed");

    const plan = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    const ready = plan.selectedIdentities.find(
      (row) => row.sourceRecordId === initiative.initiativeId,
    );
    assert.ok(ready);
    assert.equal(
      ready.architectureRetryBasis,
      "HISTORICAL_FAILURE_SEMANTICS_UNKNOWN_LEGACY_v1",
    );

    const executed = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    assert.ok(executed.presentationsScheduled >= 1);

    // New pending enqueue — historical failure metadata still peekable until overwritten by new event lifecycle.
    const pending = listContentTranslationWarmMemoryPendingForTests();
    assert.ok(
      pending.some(
        (row) =>
          row.command.sourceRecordId === initiative.initiativeId &&
          row.command.reason === "operator_residual_retry",
      ),
    );
  });

  it("wait observes selected identities only; MISSING_AFTER_DISPATCH truthful", async () => {
    const waited = await waitForPublicLocalizationMaterialization({
      workItems: [
        {
          sourceKind: "initiative",
          sourceRecordId: "selected-only-08k22",
          sourceVersion: "v1",
          targetLanguage: "uk",
          state: "MISSING",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 1,
          fallbackPaths: ["title"],
        },
      ],
      timeoutMs: 500,
      pollIntervalMs: 50,
    });
    assert.equal(waited.progress.WORK_ITEMS_TOTAL, 1);
    assert.equal(waited.timedOut, false);
    assert.equal(waited.progress.MISSING, 1);
    assert.equal(waited.progress.PENDING, 0);

    // Simulate published outbox without CURRENT → MISSING_AFTER_DISPATCH
    const initiative = sampleInitiative("mad");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const enqueued = await enqueueContentTranslationWarmRequested({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
      reason: "operator_residual_retry",
      targetLocales: ["uk"],
    });
    assert.ok(enqueued.eventId);
    const { markContentTranslationWarmMemoryPublishedForTests } = await import(
      "../../../src/modules/language/index.js"
    );
    markContentTranslationWarmMemoryPublishedForTests(enqueued.eventId);

    const source = await loadTranslatableSource({
      sourceKind: "initiative",
      sourceRecordId: initiative.initiativeId,
    });
    assert.ok(source);

    const madWait = await waitForPublicLocalizationMaterialization({
      workItems: [
        {
          sourceKind: "initiative",
          sourceRecordId: initiative.initiativeId,
          sourceVersion: source.sourceVersion,
          targetLanguage: "uk",
          state: "MISSING",
          autoNodeCount: 1,
          missingOrStaleNodeCount: 1,
          fallbackPaths: ["title"],
        },
      ],
      timeoutMs: 500,
      pollIntervalMs: 50,
    });
    assert.equal(madWait.progress.MISSING_AFTER_DISPATCH, 1);
    assert.equal(madWait.progress.WORK_ITEMS_TOTAL, 1);
  });

  it("fresh post-audit differs from pre-audit when materialization succeeds", async () => {
    const initiative = sampleInitiative("post-audit");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);

    const pre = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    assert.ok(pre.preAudit.totals.CANONICAL_FALLBACK_NODES >= 1);
    assert.ok(pre.RETRY_SELECTED_IDENTITIES >= 1);

    const executed = await runPublicLocalizationResidualRetry({
      execute: true,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    for (const row of listContentTranslationWarmMemoryPendingForTests()) {
      if (row.command.sourceRecordId === initiative.initiativeId) {
        await processContentTranslationWarmRequested(row.command);
        const { markContentTranslationWarmMemoryPublishedForTests } = await import(
          "../../../src/modules/language/index.js"
        );
        markContentTranslationWarmMemoryPublishedForTests(row.eventId);
      }
    }

    const post = await auditPublicLocalizationCorpusPostRetry({
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });

    assert.ok(
      post.totals.CURRENT_LOCALIZED_NODES > pre.preAudit.totals.CURRENT_LOCALIZED_NODES,
    );
    assert.ok(
      post.totals.CANONICAL_FALLBACK_NODES < pre.preAudit.totals.CANONICAL_FALLBACK_NODES ||
        post.totals.CANONICAL_FALLBACK_NODES === 0,
    );
    assert.notEqual(
      post.totals.CURRENT_LOCALIZED_NODES,
      pre.preAudit.totals.CURRENT_LOCALIZED_NODES,
    );

    // Zero-fallback success only from fresh audit.
    const successFromFresh =
      post.discoveryStatus === "COMPLETE" &&
      post.totals.CANONICAL_FALLBACK_NODES === 0 &&
      post.totals.WORK_ITEMS_REQUIRED === 0;
    assert.equal(successFromFresh, true);
    assert.notEqual(
      successFromFresh,
      pre.preAudit.totals.CANONICAL_FALLBACK_NODES === 0,
    );
    void executed;
  });

  it("dry-run residual path never enqueues", async () => {
    const initiative = sampleInitiative("dry");
    createInitiative(initiative);
    createdInitiativeIds.push(initiative.initiativeId);
    const result = await runPublicLocalizationResidualRetry({
      execute: false,
      kinds: ["initiative"],
      deps: { listInitiatives: () => [initiative] },
      targetLocales: ["uk"],
    });
    assert.equal(result.mode, "dry-run");
    assert.equal(result.presentationsScheduled, 0);
    assert.equal(listContentTranslationWarmMemoryPendingForTests().length, 0);
  });

  it("residual execute never falls back to full-corpus selection helper", () => {
    const residual = readApi(
      "src/modules/language/public-localization-residual-retry.ts",
    );
    assert.match(residual, /selectReadyPresentationsForResidualRetry/);
    assert.equal(
      residual.includes("import") &&
        /import\s*\{[^}]*uniquePresentationsRequiringWork/.test(residual),
      false,
    );
    assert.doesNotMatch(
      residual,
      /uniquePresentationsRequiringWork\s*\(/,
    );
    assert.match(residual, /operator_residual_retry/);
    assert.match(residual, /targetLocales/);
  });
});
