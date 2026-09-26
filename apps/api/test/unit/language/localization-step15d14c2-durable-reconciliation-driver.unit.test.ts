/**
 * STEP 15D.14.C.2 — durable localization reconciliation driver.
 * Proves completed+WEB_UI READY+work wakes Gate C residual without Activate/Resume.
 * No provider calls. No locale-specific branches. Gate D not started.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import type { TerminologyConcept, TranslatedContentRecord } from "@hu/types";

import {
  classifyContentTranslationForReconciliation,
  classifyContentTranslationValidity,
} from "../../../src/modules/language/content-translation-validity.js";
import {
  assessLocalizationReconciliationEligibility,
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

const here = path.dirname(fileURLToPath(import.meta.url));

function emptyCtBucket(overrides: {
  missing?: number;
  stale?: number;
  invalid?: number;
  workItemsRequired?: number;
}) {
  const missing = overrides.missing ?? 0;
  const stale = overrides.stale ?? 0;
  const invalid = overrides.invalid ?? 0;
  return {
    ct: {
      current: 0,
      missing,
      stale,
      invalid,
      failed: 0,
      pending: 0,
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
    items: plpWorkItems
      ? [
          {
            owner: "PLP" as const,
            kindId: "public_editorial",
            locale: "ka",
            workItemsRequired: plpWorkItems,
            missing: plpWorkItems,
            stale: 0,
            failed: 0,
            current: 0,
            action: "enqueue" as const,
          },
        ]
      : [],
    excluded: [],
    summary: {
      ctWorkItems: 0,
      plpWorkItems,
      skippedCurrent: 0,
    },
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
}) {
  const ready = overrides.ready ?? overrides.scheduled ?? 0;
  const toEnqueue = overrides.toEnqueue ?? overrides.scheduled ?? 0;
  return {
    mode: "execute" as const,
    preAudit: {} as never,
    selection: { ready: [], blocked: [] } as never,
    RETRY_READY_IDENTITIES: ready,
    RETRY_BLOCKED_IDENTITIES: overrides.blocked ?? 0,
    RETRY_SELECTED_IDENTITIES: ready,
    selectedIdentities: [],
    blockedIdentities: [],
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

function registryRecord(input: {
  locale: string;
  enabled?: boolean;
  contentTranslationEnabled?: boolean;
}) {
  return {
    languageId: `lang-${input.locale}`,
    locale: input.locale,
    enabled: input.enabled ?? true,
    contentTranslationEnabled: input.contentTranslationEnabled ?? true,
    searchEnabled: false,
    seoIndexingEnabled: false,
    displayName: input.locale,
    nativeName: input.locale,
    aliases: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function webUiReady() {
  return { dataReady: true as const };
}

function webUiNotReady() {
  return { dataReady: false as const };
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

describe("STEP 15D.14.C.2 durable reconciliation driver", () => {
  it("A. completed + WEB_UI READY + MISSING -> schedules reconciliation", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ missing: 5, workItemsRequired: 5 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 2, ready: 5, toEnqueue: 2 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, true);
    assert.equal(eligibility.workItemsRequired, 5);

    wakeLocalizationReconciliationAfterActivation({
      locale: "ka",
      webUiReady: true,
      activationStatus: "completed",
      workItemsRequired: 5,
    });
    await flushMicrotasks();
    assert.equal(residualCalls, 1);
  });

  it("B. completed + WEB_UI READY + INVALID -> schedules reconciliation", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ invalid: 3, workItemsRequired: 3 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 3, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, true);
    assert.ok(eligibility.workItemsRequired >= 3);

    scheduleLocalizationReconciliation({
      locale: "ka",
      reason: "activation_completed_with_work",
    });
    await flushMicrotasks();
    assert.equal(residualCalls, 1);
  });

  it("C. completed + WEB_UI READY + STALE -> schedules reconciliation", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "zh-Hant" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ stale: 4, workItemsRequired: 4 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 4, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    assert.equal(
      (await assessLocalizationReconciliationEligibility("zh-Hant")).eligible,
      true,
    );
    scheduleLocalizationReconciliation({ locale: "zh-Hant", reason: "test" });
    await flushMicrotasks();
    assert.equal(residualCalls, 1);
  });

  it("D. completed + workRemaining=0 -> no scheduling", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({}),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({});
      },
      enqueuePlp: async () => undefined,
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.reason, "no_actionable_work");

    wakeLocalizationReconciliationAfterActivation({
      locale: "ka",
      webUiReady: true,
      activationStatus: "completed",
      workItemsRequired: 0,
    });
    scheduleLocalizationReconciliation({ locale: "ka", reason: "test" });
    await flushMicrotasks();
    // Pass may run but residual must not enqueue when ineligible (ran=false path).
    assert.equal(residualCalls, 0);
  });

  it("E. WEB_UI not authoritative READY -> no CT/PLP scheduling", async () => {
    let residualCalls = 0;
    let plpCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiNotReady(),
      measureCtWork: async () => emptyCtBucket({ missing: 10 }),
      planBackfill: async () => emptyPlan(5),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1 });
      },
      enqueuePlp: async () => {
        plpCalls += 1;
      },
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.reason, "web_ui_not_ready");

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, false);
    assert.equal(residualCalls, 0);
    assert.equal(plpCalls, 0);
  });

  it("F. contentTranslationEnabled=false -> no scheduling", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () =>
        registryRecord({ locale: "ka", contentTranslationEnabled: false }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ missing: 3 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1 });
      },
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.reason, "registry_ineligible");
    assert.equal(residualCalls, 0);
  });

  it("G. duplicate wakes -> single-flight / coalesced", async () => {
    let residualCalls = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ missing: 2 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        await gate;
        return residualResult({ scheduled: 1, ready: 1, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    scheduleLocalizationReconciliation({ locale: "ka", reason: "source_mutation" });
    scheduleLocalizationReconciliation({ locale: "ka", reason: "terminology_mutation" });
    await flushMicrotasks(4);
    const mid = peekLocalizationReconciliationDriverStateForTests();
    assert.equal(mid.inFlight.includes("ka"), true);
    assert.equal(mid.pendingWake.includes("ka"), true);
    assert.equal(residualCalls, 1);

    release();
    await flushMicrotasks(12);
    // Coalesced follow-up may run once more after in-flight clears — never parallel.
    assert.ok(residualCalls <= 2);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().inFlight.includes("ka"),
      false,
    );
  });

  it("H. one bounded pass + work remains -> durable continuation scheduled", async () => {
    let residualCalls = 0;
    let measurePhase = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => {
        measurePhase += 1;
        // First eligibility + after-pass still have work.
        return emptyCtBucket({ missing: 10, workItemsRequired: 10 });
      },
      planBackfill: async () => emptyPlan(0),
      runResidual: async (input) => {
        residualCalls += 1;
        assert.equal(input.maxPresentations, 3);
        return residualResult({
          scheduled: 3,
          ready: 10,
          toEnqueue: 3,
        });
      },
      enqueuePlp: async () => undefined,
      maxPresentationsPerPass: 3,
      continuationDelayMs: 60_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, true);
    assert.equal(pass.continuationScheduled, true);
    assert.equal(pass.presentationsScheduled, 3);
    assert.ok(measurePhase >= 2);

    scheduleLocalizationReconciliation({ locale: "ka", reason: "test" });
    await flushMicrotasks();
    const state = peekLocalizationReconciliationDriverStateForTests();
    assert.equal(state.delayedLocales.includes("ka"), true);
    assert.ok(residualCalls >= 1);
  });

  it("I. one bounded pass + zero work -> stops", async () => {
    let measureCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => {
        measureCalls += 1;
        // Eligible before pass; clean after.
        if (measureCalls <= 1) {
          return emptyCtBucket({ missing: 1 });
        }
        return emptyCtBucket({});
      },
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => residualResult({ scheduled: 1, ready: 1, toEnqueue: 1 }),
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, true);
    assert.equal(pass.continuationScheduled, false);
    assert.equal(pass.workItemsRequiredAfter, 0);

    scheduleLocalizationReconciliation({ locale: "ka", reason: "test" });
    await flushMicrotasks();
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().delayedLocales.includes("ka"),
      false,
    );
  });

  it("J. restart/boot -> completed language with work is rediscovered", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      listTargetLocales: async () => ["ka", "zh-Hant"] as never,
      resolveLocale: async (locale) => registryRecord({ locale }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async ({ locale }) =>
        locale === "ka"
          ? emptyCtBucket({ missing: 23 })
          : emptyCtBucket({}),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({ scheduled: 1, ready: 1, toEnqueue: 1 });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
    });

    const boot = await resumeLocalizationReconciliationOnBoot();
    assert.equal(boot.scheduled, 2);
    await flushMicrotasks(16);
    // Only ka has work; zh-Hant eligibility fails before residual.
    assert.equal(residualCalls, 1);
  });

  it("K. transient provider cooldown -> no hot loop + future automatic continuation", async () => {
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord({ locale: "zh-Hant" }),
      assessWebUi: async () => webUiReady(),
      measureCtWork: async () => emptyCtBucket({ invalid: 2 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult({
          scheduled: 0,
          ready: 0,
          blocked: 2,
          toEnqueue: 0,
        });
      },
      enqueuePlp: async () => undefined,
      continuationDelayMs: 60_000,
      noProgressBaseDelayMs: 5_000,
      noProgressMaxDelayMs: 20_000,
    });

    const pass = await runLocalizationReconciliationPass("zh-Hant");
    assert.equal(pass.ran, true);
    assert.equal(pass.continuationScheduled, true);
    assert.equal(pass.usefulProgress, false);
    assert.equal(pass.continuationKind, "provider_pressure_backoff");
    assert.ok(pass.continuationDelayMs >= 5_000);
    assert.equal(residualCalls, 1);

    scheduleLocalizationReconciliation({ locale: "zh-Hant", reason: "test" });
    await flushMicrotasks();
    assert.equal(residualCalls, 2);
    assert.equal(
      peekLocalizationReconciliationDriverStateForTests().delayedLocales.includes(
        "zh-hant",
      ),
      true,
    );
    await flushMicrotasks(8);
    assert.equal(residualCalls, 2);
  });

  it("L. Admin/readiness GET -> no scheduling/provider side effect (source invariant)", () => {
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
    assert.ok(adminViewStart > 0);
    const adminViewSlice = jobService.slice(adminViewStart, adminViewStart + 4500);
    assert.doesNotMatch(adminViewSlice, /scheduleLocalizationReconciliation/);
    assert.doesNotMatch(adminViewSlice, /wakeLocalizationReconciliationAfterActivation/);
    assert.doesNotMatch(adminViewSlice, /runLocalizationReconciliationPass/);
    assert.match(jobService, /Status refresh never sets reconcileResiduals/);

    const driver = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-driver.ts",
      ),
      "utf8",
    );
    assert.match(driver, /Read paths must never call schedule\/run APIs/);
  });

  it("M. source mutation -> lightweight wake (compatible with targeted warm)", () => {
    const changed = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/public-presentation-changed.ts",
      ),
      "utf8",
    );
    assert.match(changed, /scheduleContentTranslationWarmAfterMutation/);
    assert.match(changed, /scheduleLocalizationReconciliationForAutomaticLocales/);
    assert.match(changed, /source_mutation/);
    assert.match(changed, /Prefer schedule over synchronous corpus work/);
  });

  it("N. terminology mutation affecting localizationInputVersion -> reconciliation wake", () => {
    const terminology = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/terminology-glossary/admin-terminology-glossary.service.ts",
      ),
      "utf8",
    );
    assert.match(terminology, /scheduleLocalizationReconciliationForAutomaticLocales/);
    assert.match(terminology, /terminology_mutation/);
  });

  it("O. SOURCE_ORIGINAL participant_public -> no work obligation", () => {
    assert.equal(participantPublicHasMachineLocalizationObligation(), false);
  });

  it("P. Public News source-original / CT warm stays off on mutation path", () => {
    const changed = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/public-presentation-changed.ts",
      ),
      "utf8",
    );
    assert.match(changed, /sourceKind !== "public_news"/);
  });

  it("Q. Gate C READY preserve regression", () => {
    const concepts: TerminologyConcept[] = [
      {
        conceptId: "humanity_union",
        canonicalEnglishTerm: "Humanity Union",
        category: "brand",
        status: "published",
        translations: {
          ka: { preferredTerm: "ადამიანობის კავშირი", aliases: [] },
        },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ];
    const translation: TranslatedContentRecord = {
      translationId: "t1",
      sourceKind: "initiative",
      sourceRecordId: "init-1",
      sourceVersion: "v-source",
      sourceLanguage: "en",
      targetLanguage: "ka",
      translatedContent: {
        title: "ადამიანობის კავშირი title",
        description: "desc",
      },
      translationProvider: "gemini",
      translationKind: "machine",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      stale: false,
      freshness: "current",
    };
    const classified = classifyContentTranslationForReconciliation({
      translation,
      liveSourceVersion: "v-source",
      originalFields: {
        title: "Humanity Union title",
        description: "desc",
      },
      concepts,
    });
    assert.equal(classified.reconciliationState, "READY");
  });

  it("R. Gate C INVALID deterministic regression", () => {
    const validity = classifyContentTranslationValidity({
      translation: {
        translationId: "t1",
        sourceKind: "initiative",
        sourceRecordId: "init-1",
        sourceVersion: "v-source",
        sourceLanguage: "en",
        targetLanguage: "ka",
        translationProvider: "deterministic",
        translationKind: "machine",
        translatedContent: { title: "[ka] title" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        stale: false,
        freshness: "current",
      },
      liveSourceVersion: "v-source",
    });
    assert.equal(validity.reconciliationState, "INVALID");
  });

  it("S. Gate A/B/B.2/B.2.1 regressions remain green (canonical + source-original)", async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    try {
      assert.equal(await resolveCanonicalRegistryLocale("zh-hant"), "zh-Hant");
      assert.equal(participantPublicHasMachineLocalizationObligation(), false);
    } finally {
      setLanguageRegistryForceMemoryForTests(false);
    }

    // Boot recovery wired; activation does not reopen completed→running for CT backfill.
    const indexSrc = readFileSync(
      path.resolve(here, "../../../src/index.ts"),
      "utf8",
    );
    assert.match(indexSrc, /resumeLocalizationReconciliationOnBoot/);
    const driver = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/localization-reconciliation-driver.ts",
      ),
      "utf8",
    );
    assert.match(driver, /Does not consult activation\.status/);
    assert.doesNotMatch(driver, /completed\s*->\s*running/);
  });

  it("broadcast wake schedules lightweight discovery only", async () => {
    const locales: string[] = [];
    setLocalizationReconciliationDriverDepsForTests({
      listTargetLocales: async () => {
        locales.push("ka");
        return ["ka"] as never;
      },
      resolveLocale: async () => registryRecord({ locale: "ka" }),
      assessWebUi: async () => webUiNotReady(),
      measureCtWork: async () => emptyCtBucket({ missing: 1 }),
      planBackfill: async () => emptyPlan(0),
      runResidual: async () => residualResult({}),
    });
    scheduleLocalizationReconciliationForAutomaticLocales({
      reason: "terminology_mutation",
    });
    await flushMicrotasks(10);
    assert.deepEqual(locales, ["ka"]);
  });
});
