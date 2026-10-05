/**
 * STEP 15D.14.C.3.2 — durable progress classification.
 * usefulProgress requires CURRENT/READY coverage increase only.
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

function emptyPlan(plpWorkItems = 0, plpCurrent = 0) {
  return {
    pack: "closure07" as const,
    locale: "ka",
    mode: "dry-run" as const,
    registryEligible: true,
    items:
      plpWorkItems > 0 || plpCurrent > 0
        ? [
            {
              owner: "PLP" as const,
              kindId: "public_editorial",
              locale: "ka",
              workItemsRequired: plpWorkItems,
              missing: plpWorkItems,
              stale: 0,
              failed: 0,
              current: plpCurrent,
              action: "enqueue" as const,
            },
          ]
        : [],
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

describe("STEP 15D.14.C.3.2 durable progress classification", () => {
  it("A. enqueue accepted, current unchanged -> usefulProgress=false", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 8, current: 42 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 5, ready: 8, toEnqueue: 5 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.presentationsScheduled, 5);
    assert.equal(pass.currentBefore, 42);
    assert.equal(pass.currentAfter, 42);
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
  });

  it("B. retryable identity re-enqueued, current unchanged -> false", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ invalid: 3, current: 50 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 3, ready: 3, toEnqueue: 3 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
  });

  it("C. workRequired decreases only via pending rise, current unchanged -> false", () => {
    const classified = classifyLocalizationReconciliationProgress({
      currentBefore: 42,
      currentAfter: 42,
      workItemsRequiredBefore: 19,
      workItemsRequiredAfter: 18,
      pendingBefore: 0,
      pendingAfter: 1,
      presentationsScheduled: 1,
      presentationsDeduped: 0,
      plpEnqueued: false,
      retryReadyIdentities: 1,
      presentationsToEnqueue: 1,
    });
    assert.equal(classified.workDecreased, true);
    assert.equal(classified.pendingIncreased, true);
    assert.equal(classified.newlyScheduled, true);
    assert.equal(classified.usefulProgress, false);
  });

  it("D. dedupe only -> usefulProgress=false", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 17, current: 40 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 0, deduped: 17, ready: 17, toEnqueue: 17 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.presentationsDeduped, 17);
    assert.equal(pass.usefulProgress, false);
  });

  it("E. PLP enqueue only -> usefulProgress=false", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ current: 10 }),
      planBackfill: async () => emptyPlan(4, 2),
      runResidual: async () => residualResult({ scheduled: 0 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.plpCurrentBefore, pass.plpCurrentAfter);
    assert.equal(pass.continuationKind, "no_progress_backoff");
  });

  it("F. truncated + scheduled only -> usefulProgress=false", () => {
    const classified = classifyLocalizationReconciliationProgress({
      currentBefore: 40,
      currentAfter: 40,
      workItemsRequiredBefore: 25,
      workItemsRequiredAfter: 25,
      pendingBefore: 0,
      pendingAfter: 0,
      presentationsScheduled: 25,
      presentationsDeduped: 0,
      plpEnqueued: false,
      retryReadyIdentities: 100,
      presentationsToEnqueue: 25,
    });
    assert.equal(classified.truncatedWithNewSchedule, true);
    assert.equal(classified.usefulProgress, false);
  });

  it("G. current/READY increases -> usefulProgress=true", async () => {
    let current = 42;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 5, current }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        current += 2;
        return residualResult({ scheduled: 2, ready: 5, toEnqueue: 2 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, true);
    assert.ok(pass.currentAfter > pass.currentBefore);
    assert.equal(pass.continuationKind, "normal");
  });

  it("H. durable progress + remaining work -> normal 60s continuation", async () => {
    let current = 40;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 9, current }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        current += 1;
        return residualResult({ scheduled: 1, ready: 9, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, true);
    assert.equal(pass.continuationKind, "normal");
    assert.equal(
      pass.continuationDelayMs,
      LOCALIZATION_RECONCILIATION_CONTINUATION_DELAY_MS,
    );
    assert.equal(pass.noProgressStreak, 0);
  });

  it("I. no durable progress + remaining work -> 5m backoff", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 9, current: 40 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 4, ready: 9, toEnqueue: 4 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "no_progress_backoff");
    assert.equal(
      pass.continuationDelayMs,
      LOCALIZATION_RECONCILIATION_NO_PROGRESS_BASE_DELAY_MS,
    );
    assert.equal(pass.noProgressStreak, 1);
  });

  it("J. repeated no durable progress -> 10m -> 20m -> 30m cap", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 5, current: 10 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({ scheduled: 1, ready: 5, toEnqueue: 1 }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5 * 60_000,
      noProgressMaxDelayMs: 30 * 60_000,
    });
    const delays: number[] = [];
    for (let i = 0; i < 5; i += 1) {
      const pass = await runLocalizationReconciliationPass("ka");
      delays.push(pass.continuationDelayMs);
    }
    assert.deepEqual(delays, [
      5 * 60_000,
      10 * 60_000,
      20 * 60_000,
      30 * 60_000,
      30 * 60_000,
    ]);
  });

  it("K. durable progress after backoff -> streak reset", async () => {
    let current = 10;
    let bump = false;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 4, current }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        if (bump) current += 1;
        return residualResult({ scheduled: 1, ready: 4, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
      noProgressBaseDelayMs: 5_000,
    });
    await runLocalizationReconciliationPass("ka");
    await runLocalizationReconciliationPass("ka");
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().noProgressStreakByLocale
        .ka,
      2,
    );
    bump = true;
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.usefulProgress, true);
    assert.equal(pass.noProgressStreak, 0);
    assert.equal(pass.continuationKind, "normal");
  });

  it("L. zero work -> idle", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ current: 50 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => residualResult({}),
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, false);
    assert.equal(pass.continuationKind, "none");
    assert.equal(pass.continuationScheduled, false);
  });

  it("M. completed Georgian-style language still discovered on boot", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      listTargetLocales: async () => ["ka"] as never,
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 9, current: 50 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 9, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 60_000,
    });
    const boot = await resumeLocalizationReconciliationOnBoot();
    assert.equal(boot.scheduled, 1);
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
  });

  it("N. provider 429/retry re-enqueue cannot reset noProgressStreak", async () => {
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ invalid: 4, current: 40 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () =>
        residualResult({
          scheduled: 4,
          ready: 4,
          toEnqueue: 4,
        }),
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 5_000,
    });
    const first = await runLocalizationReconciliationPass("ka");
    assert.equal(first.usefulProgress, false);
    assert.equal(first.noProgressStreak, 1);
    const second = await runLocalizationReconciliationPass("ka");
    assert.equal(second.presentationsScheduled, 4);
    assert.equal(second.usefulProgress, false);
    assert.equal(second.noProgressStreak, 2);
    assert.ok(second.continuationDelayMs > first.continuationDelayMs);
  });

  it("O. participant_public SOURCE_ORIGINAL remains excluded", () => {
    assert.equal(participantPublicHasMachineLocalizationObligation(), false);
  });

  it("P. Public News remains excluded on mutation path", () => {
    const changed = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/public-presentation-changed.ts",
      ),
      "utf8",
    );
    assert.match(changed, /sourceKind !== "public_news"/);
  });

  it("Q. source/terminology wakes preserved", () => {
    const changed = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/public-presentation-changed.ts",
      ),
      "utf8",
    );
    assert.match(changed, /source_mutation/);
    const terminology = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/terminology-glossary/admin-terminology-glossary.service.ts",
      ),
      "utf8",
    );
    assert.match(terminology, /terminology_mutation/);
  });

  it("R. Admin/readiness GET remains side-effect free", () => {
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
    const slice = jobService.slice(adminViewStart, adminViewStart + 4500);
    assert.doesNotMatch(slice, /scheduleLocalizationReconciliation/);
    assert.doesNotMatch(slice, /runLocalizationReconciliationPass/);
  });

  it("S. Gate C READY preservation", () => {
    const plan = planLocalizationReconciliationItem({
      owner: "CT",
      entityType: "initiative",
      entityId: "x",
      targetLocale: "ka",
      reconciliationState: "READY",
    });
    assert.equal(plan.action, "PRESERVE");
    assert.equal(isProviderWorkAction(plan.action), false);
  });

  it("T. Gate A/B/B.2/B.2.1 + C.3 durable-current invariant regressions", async () => {
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

    const driver = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-driver.ts",
      ),
      "utf8",
    );
    assert.match(driver, /usefulProgress: durableCurrentIncreased/);
    assert.match(driver, /currentBefore/);
    assert.match(driver, /currentAfter/);
    assert.doesNotMatch(
      driver,
      /usefulProgress:\s*workDecreased\s*\|\|/,
    );
  });

  it("mutation wakes during backoff still coalesce", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      listTargetLocales: async () => ["ka"] as never,
      resolveLocale: async () => registryRecord(),
      assessWebUi: async () => ({ dataReady: true }),
      measureCtWork: async () => emptyCtBucket({ missing: 2, current: 1 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 2, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      noProgressBaseDelayMs: 60_000,
    });
    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    await flushMicrotasks(12);
    assert.equal(residualCalls, 1);
    scheduleLocalizationReconciliationForAutomaticLocales({
      reason: "source_mutation",
    });
    wakeLocalizationReconciliationAfterActivation({
      locale: "ka",
      webUiReady: true,
      activationStatus: "completed",
      workItemsRequired: 2,
    });
    await flushMicrotasks(8);
    assert.equal(residualCalls, 1);
  });
});
