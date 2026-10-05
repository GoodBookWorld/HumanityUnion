/**
 * STEP 15D.14.F.3.7 — defer expensive automatic corpus work during the
 * shared provider cooldown. Does not change readiness truth or ownership.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { isLocalizationSourceOriginalEntityType } from "@hu/types";

import {
  assessLocalizationReconciliationEligibility,
  peekLocalizationReconciliationDriverStateForTests,
  resetLocalizationReconciliationDriverForTests,
  resumeLocalizationReconciliationOnBoot,
  runLocalizationReconciliationPass,
  scheduleLocalizationReconciliation,
  setLocalizationReconciliationDriverDepsForTests,
} from "../../../src/modules/language/localization-reconciliation-driver.js";
import {
  readLocalizationProviderCooldown,
} from "../../../src/modules/language/localization-provider-governor.js";
import {
  activateLocalizationProviderPressure,
  resetThinGeminiProviderStateForTests,
  setThinGeminiProviderStateForceMemoryForTests,
} from "../../../src/modules/language/media-plp-materializer/thin-gemini-provider-state.js";
import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/language-registry/index.js";
import {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import {
  getLanguageActivationJobById,
  saveLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import {
  resetLanguageActivationJobStoreForTests,
  setLanguageActivationJobForceMemoryForTests,
} from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import { resetWebUiControlledLabelCacheForTests } from "../../../src/modules/language/controlled-lifecycle-web-ui-labels.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const NOW = 1_700_000_000_000;
const COOLDOWN_UNTIL = new Date(NOW + 60_000).toISOString();
const EXTENDED_UNTIL = new Date(NOW + 180_000).toISOString();

function registryRecord(locale: string) {
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

function emptyCt(invalid = 0) {
  return {
    ct: {
      current: 50,
      missing: 0,
      stale: 0,
      invalid,
      failed: 0,
      pending: 0,
      workItemsRequired: invalid,
    },
    kindRows: [],
  };
}

function emptyPlan() {
  return {
    pack: "closure07" as const,
    locale: "ka",
    mode: "dry-run" as const,
    registryEligible: true,
    items: [],
    excluded: [],
    summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
    PROVIDER_CALLS: 0 as const,
    WRITES_PERFORMED: 0 as const,
  };
}

function residualResult() {
  return {
    mode: "execute" as const,
    preAudit: {} as never,
    selection: { ready: [], blocked: [] } as never,
    RETRY_READY_IDENTITIES: 9,
    RETRY_BLOCKED_IDENTITIES: 0,
    RETRY_SELECTED_IDENTITIES: 9,
    selectedIdentities: [],
    blockedIdentities: [],
    schedule: [],
    presentationsToEnqueue: 1,
    presentationGroupingExplained: false,
    selectedWorkItems: [],
    presentationsScheduled: 1,
    presentationsDeduped: 0,
    presentationsFailed: 0,
    enqueueResults: [],
    abortReason: null,
  };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 8; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
  }
}

describe("STEP 15D.14.F.3.7 cooldown deferral", () => {
  beforeEach(() => {
    resetLocalizationReconciliationDriverForTests();
    setThinGeminiProviderStateForceMemoryForTests(true);
    resetThinGeminiProviderStateForTests();
  });

  afterEach(() => {
    resetLocalizationReconciliationDriverForTests();
    resetThinGeminiProviderStateForTests();
    setThinGeminiProviderStateForceMemoryForTests(false);
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
  });

  it("reads the shared cooldown without arming pressure, and treats expiry as inactive", async () => {
    const before = await readLocalizationProviderCooldown();
    assert.equal(before.active, false);
    assert.equal(before.cooldownUntil, null);
    const armedAt = Date.now();
    await activateLocalizationProviderPressure({
      category: "rate_limited",
      nowMs: armedAt,
      retryAfterSeconds: 60,
    });
    const { setLocalizationProviderClockForTests } = await import(
      "../../../src/modules/language/localization-provider-governor.js"
    );
    setLocalizationProviderClockForTests(() => armedAt + 1_000);
    const active = await readLocalizationProviderCooldown();
    assert.equal(active.active, true);
    assert.equal(active.pressureCategory, "rate_limited");
    assert.ok(active.cooldownUntil);
    const second = await readLocalizationProviderCooldown();
    assert.equal(second.cooldownUntil, active.cooldownUntil);
    assert.equal(second.pressureCategory, "rate_limited");
    setLocalizationProviderClockForTests(() => armedAt + 120_000);
    const afterExpiry = await readLocalizationProviderCooldown();
    assert.equal(afterExpiry.active, false);
    assert.equal(afterExpiry.cooldownUntil, null);
    setLocalizationProviderClockForTests(null);
  });

  it("1-6. active cooldown skips corpus, planning, and enqueue, and wakes once at cooldownUntil", async () => {
    let measureCalls = 0;
    let planCalls = 0;
    let residualCalls = 0;
    let enqueueCalls = 0;
    let cooldownReads = 0;
    setLocalizationReconciliationDriverDepsForTests({
      nowMs: () => NOW,
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      readProviderCooldown: async () => {
        cooldownReads += 1;
        return {
          active: true,
          cooldownUntil: COOLDOWN_UNTIL,
          pressureCategory: "rate_limited",
        };
      },
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(9);
      },
      planBackfill: async () => {
        planCalls += 1;
        return emptyPlan();
      },
      runResidual: async () => {
        residualCalls += 1;
        return residualResult();
      },
      enqueuePlp: async () => {
        enqueueCalls += 1;
      },
    });

    const eligibility = await assessLocalizationReconciliationEligibility("ka");
    assert.equal(eligibility.reason, "provider_cooldown");
    assert.equal(eligibility.eligible, false);
    assert.equal(eligibility.workItemsRequired, 0);
    assert.equal(eligibility.ctCurrent, 0);
    assert.equal(measureCalls, 0);

    scheduleLocalizationReconciliation({ locale: "ka", reason: "boot" });
    await flushMicrotasks();
    assert.equal(measureCalls, 0);
    assert.equal(planCalls, 0);
    assert.equal(residualCalls, 0);
    assert.equal(enqueueCalls, 0);
    assert.ok(cooldownReads >= 1);

    const state = peekLocalizationReconciliationDriverStateForTests();
    assert.deepEqual(state.delayedLocales, ["ka"]);
    assert.equal(state.delayedDueAtMs.ka, Date.parse(COOLDOWN_UNTIL));

    scheduleLocalizationReconciliation({ locale: "ka", reason: "continuation" });
    await flushMicrotasks();
    const again = peekLocalizationReconciliationDriverStateForTests();
    assert.deepEqual(again.delayedLocales, ["ka"]);
    assert.equal(again.delayedDueAtMs.ka, Date.parse(COOLDOWN_UNTIL));
    assert.equal(measureCalls, 0);
  });

  it("7-8. expired cooldown proceeds, and an extended cooldown defers again", async () => {
    let phase: "open" | "extended" = "open";
    let measureCalls = 0;
    let residualCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      nowMs: () => NOW,
      resolveLocale: async () => registryRecord("uk"),
      assessWebUi: async () => ({ dataReady: true }) as never,
      readProviderCooldown: async () => {
        if (phase === "open") {
          return {
            active: false,
            cooldownUntil: null,
            pressureCategory: null,
          };
        }
        return {
          active: true,
          cooldownUntil: EXTENDED_UNTIL,
          pressureCategory: "rate_limited",
        };
      },
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(9);
      },
      planBackfill: async () => emptyPlan(),
      runResidual: async () => {
        residualCalls += 1;
        return residualResult();
      },
      enqueuePlp: async () => undefined,
    });

    const proceeded = await runLocalizationReconciliationPass("uk");
    assert.equal(proceeded.ran, true);
    assert.equal(measureCalls, 2);
    assert.equal(residualCalls, 1);
    assert.equal(proceeded.reason, "no_progress_backoff");

    phase = "extended";
    const deferred = await runLocalizationReconciliationPass("uk");
    assert.equal(deferred.reason, "provider_cooldown");
    assert.equal(deferred.continuationScheduled, true);
    assert.equal(deferred.notBeforeMs, Date.parse(EXTENDED_UNTIL));
    assert.equal(measureCalls, 2);
    assert.equal(residualCalls, 1);
  });

  it("9. WEB_UI not ready stays blocked and does not consult cooldown or measure", async () => {
    let measureCalls = 0;
    let cooldownReads = 0;
    setLocalizationReconciliationDriverDepsForTests({
      resolveLocale: async () => registryRecord("ar"),
      assessWebUi: async () => ({ dataReady: false }),
      readProviderCooldown: async () => {
        cooldownReads += 1;
        return {
          active: true,
          cooldownUntil: COOLDOWN_UNTIL,
          pressureCategory: "rate_limited",
        };
      },
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(0);
      },
      planBackfill: async () => emptyPlan(),
    });
    const eligibility = await assessLocalizationReconciliationEligibility("ar");
    assert.equal(eligibility.reason, "web_ui_not_ready");
    assert.equal(measureCalls, 0);
    assert.equal(cooldownReads, 0);
  });

  it("13. boot rediscovers unfinished work after the in-memory wake is gone", async () => {
    let measureCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      nowMs: () => NOW,
      listTargetLocales: async () => ["ka"],
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(9);
      },
      planBackfill: async () => emptyPlan(),
      runResidual: async () => residualResult(),
      enqueuePlp: async () => undefined,
    });
    resetLocalizationReconciliationDriverForTests();
    setLocalizationReconciliationDriverDepsForTests({
      nowMs: () => NOW,
      listTargetLocales: async () => ["ka"],
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(9);
      },
      planBackfill: async () => emptyPlan(),
      runResidual: async () => residualResult(),
      enqueuePlp: async () => undefined,
    });
    const boot = await resumeLocalizationReconciliationOnBoot();
    assert.equal(boot.scheduled, 1);
    await flushMicrotasks();
    assert.ok(measureCalls >= 1);
  });

  it("16-17. INVALID work stays actionable after cooldown, and public news stays source-original", async () => {
    assert.equal(isLocalizationSourceOriginalEntityType("public_news"), true);
    let measureCalls = 0;
    setLocalizationReconciliationDriverDepsForTests({
      nowMs: () => NOW + 120_000,
      resolveLocale: async () => registryRecord("ka"),
      assessWebUi: async () => ({ dataReady: true }),
      readProviderCooldown: async () => ({
        active: false,
        cooldownUntil: null,
        pressureCategory: null,
      }),
      measureCtWork: async () => {
        measureCalls += 1;
        return emptyCt(9);
      },
      planBackfill: async () => emptyPlan(),
      runResidual: async () => residualResult(),
      enqueuePlp: async () => undefined,
    });
    const pass = await runLocalizationReconciliationPass("ka");
    assert.equal(pass.ran, true);
    assert.ok(measureCalls >= 1);
    assert.equal(pass.retryReadyIdentities, 9);
    assert.equal(pass.ctCurrentBefore, 50);
  });

  it("14-15. Admin readiness and the activation-status guard are unchanged", () => {
    const service = readFileSync(
      path.resolve(
        here,
        "../../../src/modules/language/language-localization-activation/language-activation-job.service.ts",
      ),
      "utf8",
    );
    const adminStart = service.indexOf("export async function getLanguageActivationAdminView");
    const adminEnd = service.indexOf("export function scheduleLanguageActivationJobProcess");
    const adminFn = service.slice(adminStart, adminEnd);
    assert.match(adminFn, /evaluate\(/);
    assert.doesNotMatch(adminFn, /readLocalizationProviderCooldown|readProviderCooldown/);

    const guard = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/administration/admin-languages-activation-status-guard.ts",
      ),
      "utf8",
    );
    assert.match(guard, /function runGuardedActivationStatus/);
    const section = readFileSync(
      path.resolve(
        here,
        "../../../../web/src/features/administration/components/AdminLanguagesSection.tsx",
      ),
      "utf8",
    );
    assert.match(section, /runGuardedActivationStatus/);
  });
});

describe("STEP 15D.14.F.3.7 activation deferral", () => {
  beforeEach(async () => {
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    resetWebUiControlledLabelCacheForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-test",
    }));
    setLanguageActivationJobProcessDepsForTests(null);
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
  });

  async function createLocale(locale: string) {
    return createLanguageRegistryRecord({
      locale,
      englishName: `Test ${locale}`,
      nativeName: locale,
      textDirection: "ltr",
      fallbackLocale: "en",
      enabled: true,
      contentTranslationEnabled: true,
      searchEnabled: false,
      seoIndexingEnabled: false,
      pwaPersistedReadingEnabled: false,
      uiTranslationStatus: "none",
    });
  }

  it("10 and 12. ready WEB_UI activation skips corpus measurement and keeps checkpoints", async () => {
    const record = await createLocale("ka-f37");
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-test",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const jobId = started.job!.jobId;
    const existing = await getLanguageActivationJobById(jobId);
    assert.ok(existing);
    await saveLanguageActivationJob({
      ...existing,
      domains: {
        ...existing.domains,
        brand: { ...existing.domains.brand, status: "ready" },
        terminology: { ...existing.domains.terminology, status: "ready" },
        webUi: {
          ...existing.domains.webUi,
          status: "ready",
          dataReady: true,
          preparationPhase: "ready",
          completedBatches: 4,
          totalBatches: 4,
          checkpointId: "checkpoint-f37",
        },
      },
    });
    let evaluateCalls = 0;
    let activateCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      skipCorpusInReadiness: true,
      assessWebUi: async () => ({
        engineReady: true,
        dataReady: true,
        requiredKeyCount: 1,
        missingKeyCount: 0,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      readProviderCooldown: async () => ({
        active: true,
        cooldownUntil: COOLDOWN_UNTIL,
        pressureCategory: "rate_limited",
      }),
      evaluateReadiness: async () => {
        evaluateCalls += 1;
        throw new Error("corpus measurement must not run during cooldown");
      },
      activate: async () => {
        activateCalls += 1;
        throw new Error("enqueue must not run during cooldown");
      },
    });
    const job = await processLanguageActivationJob(jobId, { reconcileResiduals: true });
    assert.equal(evaluateCalls, 0);
    assert.equal(activateCalls, 0);
    assert.notEqual(job.status, "failed");
    assert.equal(job.domains.webUi.completedBatches, 4);
    assert.equal(job.domains.webUi.checkpointId, "checkpoint-f37");
    assert.equal(job.domains.webUi.status, "ready");
    assert.equal(job.domains.webUi.nextAttemptAt, COOLDOWN_UNTIL);

    resetLanguageActivationJobSchedulerForTests();
    const boot = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.ok(boot.scheduled >= 1);
    const rediscovered = await getLanguageActivationJobById(jobId);
    assert.equal(rediscovered?.status, "running");
    assert.equal(rediscovered?.domains.webUi.completedBatches, 4);
    assert.equal(rediscovered?.domains.webUi.checkpointId, "checkpoint-f37");
  });

  it("11. validating WEB_UI is not treated as provider-blocked corpus work", async () => {
    const record = await createLocale("uk-f37");
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-test",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const jobId = started.job!.jobId;
    const existing = await getLanguageActivationJobById(jobId);
    assert.ok(existing);
    await saveLanguageActivationJob({
      ...existing,
      domains: {
        ...existing.domains,
        brand: { ...existing.domains.brand, status: "ready" },
        terminology: { ...existing.domains.terminology, status: "ready" },
        webUi: {
          ...existing.domains.webUi,
          status: "in_progress",
          dataReady: false,
          preparationPhase: "validating",
          completedBatches: 2,
          checkpointId: "checkpoint-validate",
        },
      },
    });
    let evaluateCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      skipCorpusInReadiness: true,
      assessWebUi: async () => ({
        engineReady: true,
        dataReady: false,
        requiredKeyCount: 1,
        missingKeyCount: 1,
        emptyKeyCount: 0,
        englishFallbackKeyCount: 0,
        sampleMissingPaths: [],
      }),
      readProviderCooldown: async () => ({
        active: true,
        cooldownUntil: COOLDOWN_UNTIL,
        pressureCategory: "rate_limited",
      }),
      evaluateReadiness: async (input) => {
        evaluateCalls += 1;
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        return evaluateLanguageLocalizationReadiness({
          ...input,
          skipCorpusPlan: true,
        });
      },
    });
    const job = await processLanguageActivationJob(jobId, { reconcileResiduals: true });
    assert.equal(evaluateCalls, 1);
    assert.equal(job.domains.webUi.preparationPhase, "validating");
    assert.equal(job.domains.webUi.completedBatches, 2);
    assert.notEqual(job.status, "failed");
  });

  it("explicit Admin activation-status still evaluates readiness during cooldown", async () => {
    const record = await createLocale("ar-f37");
    let evaluateCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      readProviderCooldown: async () => ({
        active: true,
        cooldownUntil: COOLDOWN_UNTIL,
        pressureCategory: "rate_limited",
      }),
      evaluateReadiness: async (input) => {
        evaluateCalls += 1;
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        return evaluateLanguageLocalizationReadiness({
          ...input,
          skipCorpusPlan: true,
        });
      },
    });
    const view = await getLanguageActivationAdminView({
      actorUserId: "admin-test",
      languageId: record.languageId,
    });
    assert.equal(evaluateCalls, 1);
    assert.ok(view.readiness);
    assert.equal(view.readiness.locale, record.locale);
  });
});
