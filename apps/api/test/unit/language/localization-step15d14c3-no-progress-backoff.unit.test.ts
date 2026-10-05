/**
 * STEP 15D.14.C.3 — reconciliation no-progress / provider-pressure backoff.
 * Dedupe-only / unchanged work must not short-cycle continue.
 * No provider calls. No locale-specific branches. Gate D not started.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  classifyContentTranslationForReconciliation,
  classifyContentTranslationValidity,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS,
  LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
  assessLocalizationReconciliationEligibility,
  classifyLocalizationReconciliationProgress,
  peekLocalizationReconciliationDriverStateForTests,
  resetLocalizationReconciliationDriverForTests,
  resumeLocalizationReconciliationOnBoot,
  runLocalizationReconciliationPass,
  scheduleLocalizationReconciliation,
  scheduleLocalizationReconciliationForAutomaticLocales,
  setLocalizationReconciliationDriverDepsForTests,
  wakeLocalizationReconciliationAfterActivation,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  resolveCanonicalRegistryLocale,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import { participantPublicHasMachineLocalizationObligation } from "../../../src/modules/language/published-localized-presentation/universal/adapters/participant-public-adapter.js";
import {
  isProviderWorkAction,
  planLocalizationReconciliationItem,
} from "../../../src/modules/language/localization-reconciliation-planner.js";

const here = path.dirname(fileURLToPath(import.meta.url));

function emptyCtBucket(overrides: {
  missing?: number;
  stale?: number;
  invalid?: number;
  workItemsRequired?: number;
  current?: number;
  pending?: number;
}) {
  const missing = overrides.missing ?? 0;
  const stale = overrides.stale ?? 0;
  const invalid = overrides.invalid ?? 0;
  return {
    ct: {
      current: overrides.current ?? 0,
      missing,
      stale,
      invalid,
      failed: 0,
      pending: overrides.pending ?? 0,
      workItemsRequired:
        overrides.workItemsRequired ?? missing + stale + invalid,
    },
    kindRows: [],
  };
}

function emptyPlan(plpWorkItems = 0) {
  return {
    pack: "closure07" as const,
    locale: "ka",
    mode: "dry-run" as const,
    registryEligible: true,
    items: [],
    excluded: [],
    summary: { ctWorkItems: 0, plpWorkItems, skippedCurrent: 0 },
    PROVIDER_CALLS: 0 as const,
    WRITES_PERFORMED: 0 as const,
  };
}

function residualResult(overrides: {
  scheduled?: number;
  deduped?: number;
  failed?: number;
  ready?: number;
  blocked?: number;
  toEnqueue?: number;
  blockReason?: string;
}) {
  const ready = overrides.ready ?? overrides.scheduled ?? 0;
  const toEnqueue = overrides.toEnqueue ?? overrides.scheduled ?? 0;
  const blocked = overrides.blocked ?? 0;
  return {
    mode: "execute" as const,
    preAudit: {} as never,
    selection: { ready: [], blocked: [] } as never,
    RETRY_READY_IDENTITIES: ready,
    RETRY_BLOCKED_IDENTITIES: blocked,
    RETRY_SELECTED_IDENTITIES: ready,
    selectedIdentities: [],
    blockedIdentities:
      blocked > 0
        ? [
            {
              targetLocale: "ka",
              sourceKind: "initiative",
              sourceRecordId: "x",
              blockReason: overrides.blockReason ?? "pending_outbox",
            },
          ]
        : [],
    schedule: [],
    presentationsToEnqueue: toEnqueue,
    presentationGroupingExplained: false,
    selectedWorkItems: [],
    presentationsScheduled: overrides.scheduled ?? 0,
    presentationsDeduped: overrides.deduped ?? 0,
    presentationsFailed: overrides.failed ?? 0,
    enqueueResults: [],
    abortReason: null,
  };
}

function registryRecord(locale = "ka") {
  return {
    languageId: `lang-${locale}`,
    locale,
    enabled: true,
    contentTranslationEnabled: true,
    searchEnabled: false,
    seoIndexingEnabled: false,
    displayName: locale,
    nativeName: locale,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

async function flushMicrotasks(rounds = 8): Promise<void> {
  for (let i = 0; i < rounds; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setImmediate(r));
  }
}

beforeEach(() => {
  resetLocalizationReconciliationDriverForTests();
});

afterEach(() => {
  resetLocalizationReconciliationDriverForTests();
});

describe("STEP 15D.14.C.3 no-progress / provider-pressure backoff", () => {
  it("progress classifier: only durable current increase is useful progress", () => {
    const onlyDedupe = classifyLocalizationReconciliationProgress({
      currentBefore: 40,
      currentAfter: 40,
      workItemsRequiredBefore: 26,
      workItemsRequiredAfter: 26,
      pendingBefore: 0,
      pendingAfter: 0,
      presentationsScheduled: 0,
      presentationsDeduped: 17,
      plpEnqueued: false,
      retryReadyIdentities: 17,
      presentationsToEnqueue: 17,
    });
    assert.equal(onlyDedupe.usefulProgress, false);

    const newlyScheduled = classifyLocalizationReconciliationProgress({
      currentBefore: 40,
      currentAfter: 40,
      workItemsRequiredBefore: 26,
      workItemsRequiredAfter: 26,
      pendingBefore: 0,
      pendingAfter: 0,
      presentationsScheduled: 3,
      presentationsDeduped: 0,
      plpEnqueued: false,
      retryReadyIdentities: 17,
      presentationsToEnqueue: 3,
    });
    assert.equal(newlyScheduled.usefulProgress, false);

    const workDroppedViaPending = classifyLocalizationReconciliationProgress({
      currentBefore: 40,
      currentAfter: 40,
      workItemsRequiredBefore: 26,
      workItemsRequiredAfter: 17,
      pendingBefore: 0,
      pendingAfter: 9,
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      plpEnqueued: false,
      retryReadyIdentities: 0,
      presentationsToEnqueue: 0,
    });
    assert.equal(workDroppedViaPending.usefulProgress, false);

    const durableReady = classifyLocalizationReconciliationProgress({
      currentBefore: 40,
      currentAfter: 42,
      workItemsRequiredBefore: 26,
      workItemsRequiredAfter: 24,
      pendingBefore: 0,
      pendingAfter: 0,
      presentationsScheduled: 0,
      presentationsDeduped: 0,
      plpEnqueued: false,
      retryReadyIdentities: 0,
      presentationsToEnqueue: 0,
    });
    assert.equal(durableReady.usefulProgress, true);
  });

  it("A. enqueue without durable current increase -> no-progress backoff", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 10, current: 40 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 3, ready: 10, toEnqueue: 3 }),
      enqueuePlp: async () => undefined,
      continuationDelayMs: 1_000,
      noProgressBaseDelayMs: 5_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.currentBefore, pass.currentAfter);
    assert.equal(pass.continuationKind, "no_progress_backoff");
    assert.equal(pass.continuationScheduled, true);
    assert.equal(pass.continuationDelayMs, 5_000);
  });

  it("B. unchanged work + zero newly scheduled -> no-progress backoff", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 26 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 0, deduped: 0, ready: 0, toEnqueue: 0 }),
      enqueuePlp: async () => undefined,
      continuationDelayMs: 1_000,
      noProgressBaseDelayMs: 5_000,
      noProgressMaxDelayMs: 30_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
    assert.equal(pass.continuationScheduled, true);
    assert.equal(pass.continuationDelayMs, 5_000);
    assert.ok(pass.continuationDelayMs > LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS || pass.continuationDelayMs === 5_000);
    assert.equal(pass.noProgressStreak, 1);
  });

  it("C. repeated identical dedupe -> backoff, not normal continuation", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 26 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({
          scheduled: 0,
          deduped: 17,
          ready: 17,
          toEnqueue: 17,
        }),
      enqueuePlp: async () => undefined,
      continuationDelayMs: 1_000,
      noProgressBaseDelayMs: 5_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.presentationsDeduped, 17);
    assert.equal(pass.presentationsScheduled, 0);
    assert.equal(pass.workItemsRequiredAfter, 26);
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
    assert.notEqual(pass.continuationKind, "normal");
    assert.equal(pass.continuationDelayMs, 5_000);
  });

  it("D. rate_limited work -> respects deferred provider-pressure backoff", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ invalid: 4 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({
          scheduled: 0,
          ready: 0,
          blocked: 4,
          toEnqueue: 0,
          blockReason: "rate_limited",
        }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.continuationKind, "provider_pressure_backoff");
    assert.equal(pass.continuationScheduled, true);
    assert.equal(pass.continuationDelayMs, 5_000);
    assert.equal(pass.usefulProgress, false);
  });

  it("E. repeated no-progress -> bounded increasing delay", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 5 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 0, deduped: 5, ready: 5, toEnqueue: 5 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 1_000,
      noProgressMaxDelayMs: 8_000,
    });

    const first = await runLocalizationReconciliationPass("ka");
    assert.equal(first.noProgressStreak, 1);
    assert.equal(first.continuationDelayMs, 1_000);

    const second = await runLocalizationReconciliationPass("ka");
    assert.equal(second.noProgressStreak, 2);
    assert.equal(second.continuationDelayMs, 2_000);

    const third = await runLocalizationReconciliationPass("ka");
    assert.equal(third.noProgressStreak, 3);
    assert.equal(third.continuationDelayMs, 4_000);

    const fourth = await runLocalizationReconciliationPass("ka");
    assert.equal(fourth.noProgressStreak, 4);
    assert.equal(fourth.continuationDelayMs, 8_000);

    const fifth = await runLocalizationReconciliationPass("ka");
    assert.equal(fifth.noProgressStreak, 5);
    assert.equal(fifth.continuationDelayMs, 8_000); // capped
  });

  it("F. later durable current increase -> backoff resets", async () => {
    let ctCurrent = 40;
    let bumpOnResidual = false;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 5, current: ctCurrent }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        if (bumpOnResidual) {
          ctCurrent += 2;
          return residualResult({ scheduled: 2, ready: 5, toEnqueue: 2 });
        }
        return residualResult({
          scheduled: 0,
          deduped: 5,
          ready: 5,
          toEnqueue: 5,
        });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 500,
      noProgressBaseDelayMs: 5_000,
    });

    const stuck = await runLocalizationReconciliationPass("ka");
    assert.equal(stuck.continuationKind, "no_progress_backoff");
    assert.equal(stuck.noProgressStreak, 1);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().noProgressStreakByLocale
        .ka,
      1,
    );

    bumpOnResidual = true;
    const advanced = await runLocalizationReconciliationPass("ka");
    assert.equal(advanced.usefulProgress, true);
    assert.ok(advanced.currentAfter > advanced.currentBefore);
    assert.equal(advanced.continuationKind, "normal");
    assert.equal(advanced.noProgressStreak, 0);
    assert.equal(advanced.continuationDelayMs, 500);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().noProgressStreakByLocale
        .ka,
      undefined,
    );
  });

  it("G. duplicate wakes during backoff -> coalesced", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 3 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({
          scheduled: 0,
          deduped: 3,
          ready: 3,
          toEnqueue: 3,
        });
      },
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 60_000,
    });

    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().delayedLocales.includes(
        "ka",
      ),
      true,
    );

    scheduleLocalizationReconciliation({ locale: "ka", reason: "source_mutation" });
    scheduleLocalizationReconciliation({
      locale: "ka",
      reason: "terminology_mutation",
    });
    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    await flushMicrotasks(8);
    assert.equal(residualCalls, 1);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().delayedLocales.length,
      1,
    );
  });

  it("H. boot finds completed Georgian-style work -> still schedules first pass", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      listTargetLocales: async () => ["ka"] as never,
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 23 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 23, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    const boot = await resumeLocalizationReconciliationOnBoot();
    assert.equal(boot.scheduled, 1);
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
  });

  it("I. zero work -> idle", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({}),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => residualResult({}),
      enqueuePlp: async () => undefined,
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, false);

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, false);
    assert.equal(pass.continuationScheduled, false);
    assert.equal(pass.continuationKind, "none");
  });

  it("J. source mutation during backoff -> coalesced (no immediate re-entry)", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 2 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({
          scheduled: 0,
          deduped: 2,
          ready: 2,
          toEnqueue: 2,
        });
      },
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 60_000,
      listTargetLocales: async () => ["ka"] as never,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.continuationKind, "no_progress_backoff");
    scheduleLocalizationReconciliation({
      locale: "ka",
      reason: "no_progress_backoff",
      delayMs: pass.continuationDelayMs,
    });
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().delayedLocales.includes(
        "ka",
      ),
      true,
    );

    scheduleLocalizationReconciliationForAutomaticLocales({
      reason: "source_mutation",
    });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
  });

  it("K. terminology mutation during backoff -> coalesced", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ stale: 2 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({
          scheduled: 0,
          deduped: 2,
          ready: 2,
          toEnqueue: 2,
        });
      },
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 60_000,
      listTargetLocales: async () => ["ka"] as never,
    });

    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
    scheduleLocalizationReconciliationForAutomaticLocales({
      reason: "terminology_mutation",
    });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
  });

  it("L. read/Admin GET -> no side effects (source invariant)", () => {
    const jobService = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    const adminViewStart = jobService.indexOf(
      "export async function getLanguageActivationAdminView",
    );
    const adminViewSlice = jobService.slice(adminViewStart, adminViewStart + 4500);
    assert.doesNotMatch(adminViewSlice, /scheduleLocalizationReconciliation/);
    assert.doesNotMatch(adminViewSlice, /runLocalizationReconciliationPass/);

    const driver = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-driver.ts",
      ),
      "utf8",
    );
    assert.match(driver, /Read paths must never call schedule\/run APIs/);
    assert.match(driver, /presentationsDeduped/);
    assert.match(driver, /no_progress_backoff/);
    assert.ok(
      LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS >
        LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS,
    );
  });

  it("M. Gate C planner regressions", () => {
    const missing = planLocalizationReconciliationItem({
      owner: "CT",
      entityType: "initiative",
      entityId: "a",
      targetLocale: "ka",
      reconciliationState: "MISSING",
    });
    assert.equal(missing.action, "GENERATE");
    assert.equal(isProviderWorkAction(missing.action), true);

    const ready = planLocalizationReconciliationItem({
      owner: "CT",
      entityType: "initiative",
      entityId: "b",
      targetLocale: "ka",
      reconciliationState: "READY",
    });
    assert.equal(ready.action, "PRESERVE");
    assert.equal(isProviderWorkAction(ready.action), false);
  });

  it("N. C.2 completed-language wake regression", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 5 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 5, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    wakeLocalizationReconciliationAfterActivation({
      locale: "ka",
      webUiReady: true,
      activationStatus: "completed",
      workItemsRequired: 5,
    });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
  });

  it("O. Gate A/B/B.2/B.2.1 regressions", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
      assert.equal(participantPublicHasMachineLocalizationObligation(), false);
      const invalid = classifyContentTranslationValidity({
        translation: {
          translationId: "t1",
          sourceKind: "initiative",
          sourceRecordId: "i1",
          sourceVersion: "v1",
          sourceLanguage: "en",
          targetLanguage: "ka",
          translationProvider: "deterministic",
          translationKind: "machine",
          translatedContent: { title: "[ka] x" },
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          stale: false,
          freshness: "current",
        },
        liveSourceVersion: "v1",
      });
      assert.equal(invalid.reconciliationState, "INVALID");
      const missing = classifyContentTranslationForReconciliation({
        translation: null,
        liveSourceVersion: "v1",
      });
      assert.equal(missing.reconciliationState, "MISSING");
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }
  });
});
