/**
 * Step 15C.2 — activation claim and provider-free status projection.
 * Deterministic only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";

import type { WebUiActivationCheckpointPhase } from "@hu/types";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getLanguageActivationJobById, saveLanguageActivationJob } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import { fromLanguageActivationJobMongoDocument } from "../../../src/modules/language/language-localization-activation/language-activation-job.mongo-document.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
  upsertWebUiActivationCheckpoint,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const INCLUDE_PATHS = ["common.language", "common.save", "common.cancel"] as const;

function translate(request: TranslationProviderRequest) {
  const parsed = JSON.parse(request.text) as Record<string, string>;
  return {
    translatedText: JSON.stringify(
      Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, `[xx] ${value}`])),
    ),
    providerId: "deterministic",
    isPlaceholder: false,
  };
}

describe("Step 15C.2 — activation claim and status projection", () => {
  let providerCalls = 0;

  beforeEach(async () => {
    providerCalls = 0;
    setLanguageRegistryForceMemoryForTests(true);
    resetLanguageRegistryStoreForTests();
    await ensureLanguageRegistrySeeded();
    setWebUiMessagePackForceMemoryForTests(true);
    resetWebUiMessagePackStoreForTests();
    setWebUiActivationCheckpointForceMemoryForTests(true);
    resetWebUiActivationCheckpointStoreForTests();
    setLanguageActivationJobForceMemoryForTests(true);
    resetLanguageActivationJobStoreForTests();
    resetLanguageActivationJobSchedulerForTests();
    setLanguageActivationJobAdminAssertOverrideForTests(async (userId) => ({
      userId,
      participantId: "participant-admin-15c2",
    }));
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: true,
      activate: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07" as const,
          locale: input.locale,
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: input.locale,
            mode: "execute" as const,
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
            PROVIDER_CALLS: 0 as const,
            WRITES_PERFORMED: 0 as const,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 0,
            plpEditorialEnqueued: false,
            notes: [],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true,
        };
      },
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          return translate(request);
        },
      },
    });
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
  });

  async function createEligibleLocale(locale: string) {
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

  async function waitingJob(locale: string) {
    const record = await createEligibleLocale(locale);
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    const processed = await processLanguageActivationJob(started.job.jobId, {
      reconcileResiduals: true,
    });
    return { record, job: processed };
  }

  async function seedPhase(
    jobId: string,
    locale: string,
    generation: number,
    phase: WebUiActivationCheckpointPhase,
    stamp: string,
  ) {
    const checkpointId = `cp-${jobId}-${phase}`;
    await upsertWebUiActivationCheckpoint({
      checkpointId,
      jobId,
      locale,
      generation,
      sourceHash: "source-hash",
      terminologyMode: "live",
      phase,
      leafCount: 8,
      batchCount: 4,
      completedBatchCount: phase === "primary" ? 1 : 4,
      failedBatchCount: phase === "failed" ? 1 : 0,
      qualityBatchCount: phase === "quality" ? 2 : 0,
      qualityCompletedBatchCount: phase === "quality" ? 1 : 0,
      suspiciousPathCount: phase === "quality" ? 2 : 0,
      englishName: "Test",
      nativeName: locale,
      textDirection: "ltr",
      detail: null,
      createdAt: stamp,
      updatedAt: stamp,
    });
    return checkpointId;
  }

  it("1–3, 12 explicit Activate claims the same pre-15C job and refreshes CV counts", async () => {
    const { record, job } = await waitingJob("eo");
    assert.equal(job.status, "waiting_for_data");
    const stale = fromLanguageActivationJobMongoDocument({
      ...job,
      status: "waiting_for_data",
      domains: {
        ...job.domains,
        brand: undefined,
        terminology: undefined,
        webUi: {
          status: "waiting_for_data",
          dataReady: false,
          missingKeyCount: 2240,
          emptyKeyCount: 0,
          requiredKeyCount: 2240,
          effectiveSource: "none",
          detail: "waiting_for_data missing=2240",
        },
        controlledVocabulary: {
          ...job.domains.controlledVocabulary,
          conceptsMissing: 3,
          missingConceptIds: [],
          status: "waiting_for_data",
        },
      },
    } as never);
    await saveLanguageActivationJob({ ...stale, jobId: job.jobId, generation: job.generation });

    const callsBefore = providerCalls;
    const view = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.equal(view.job?.jobId, job.jobId);
    assert.equal(view.job?.generation, job.generation);
    assert.equal(view.job?.status, "running");
    assert.equal(view.job?.domains.brand.status, "in_progress");
    assert.notEqual(view.job?.domains.webUi.status, "waiting_for_data");
    assert.equal(
      view.job?.domains.controlledVocabulary.conceptsMissing,
      view.readiness.controlledVocabulary.conceptsMissingLocalizedLabel,
    );
    assert.notEqual(view.job?.domains.controlledVocabulary.conceptsMissing, 3);
    const persisted = await getLanguageActivationJobById(job.jobId);
    assert.equal(persisted?.status, "running");
    assert.equal(providerCalls, callsBefore);
    assert.equal(view.searchEnabled, false);
    assert.equal(view.seoIndexingEnabled, false);
  });

  it("4–6 status refresh is provider-free and does not restore waiting_for_data before the first tick", async () => {
    const { record, job } = await waitingJob("ia");
    await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const callsBefore = providerCalls;
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, callsBefore);
    assert.equal(status.job?.status, "running");
    assert.notEqual(status.job?.domains.webUi.status, "waiting_for_data");
    assert.equal(status.job?.jobId, job.jobId);
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: false,
      activate: async (input) => {
        const { evaluateLanguageLocalizationReadiness } = await import(
          "../../../src/modules/language/language-localization-activation/language-localization-readiness-evaluator.js"
        );
        const readiness = await evaluateLanguageLocalizationReadiness({
          locale: input.locale,
          skipCorpusPlan: true,
        });
        return {
          pack: "closure07" as const,
          locale: input.locale,
          mode: "execute" as const,
          readiness,
          plan: {
            pack: "closure07" as const,
            locale: input.locale,
            mode: "execute" as const,
            registryEligible: true,
            items: [],
            excluded: [],
            summary: { ctWorkItems: 0, plpWorkItems: 0, skippedCurrent: 0 },
            PROVIDER_CALLS: 0 as const,
            WRITES_PERFORMED: 0 as const,
          },
          execute: {
            attempted: true,
            ctKindsEnqueued: 0,
            plpEditorialEnqueued: false,
            notes: [],
          },
          PROVIDER_CALLS: 0 as const,
          WRITES_PERFORMED: 0 as const,
          seoIndexingEnabledUnchanged: true,
        };
      },
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          return translate(request);
        },
      },
    });
    const tick = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(tick.status, "running");
    assert.ok(providerCalls > callsBefore);
  });

  it("7–11 checkpoint phases project without status clobber", async () => {
    const { record, job } = await waitingJob("ie");
    await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    const phases: Array<{ phase: WebUiActivationCheckpointPhase; job: string; web: string }> = [
      { phase: "primary", job: "running", web: "in_progress" },
      { phase: "quality", job: "running", web: "in_progress" },
      { phase: "validating", job: "running", web: "in_progress" },
      { phase: "publishing", job: "running", web: "in_progress" },
      { phase: "failed", job: "failed", web: "failed" },
      { phase: "ready", job: "running", web: "ready" },
    ];
    let stamp = 0;
    for (const expected of phases) {
      stamp += 1;
      const checkpointId = await seedPhase(
        job.jobId,
        "ie",
        job.generation,
        expected.phase,
        `2026-09-20T00:00:0${stamp}.000Z`,
      );
      const current = await getLanguageActivationJobById(job.jobId);
      assert.ok(current);
      await saveLanguageActivationJob({
        ...current,
        status: "running",
        domains: {
          ...current.domains,
          webUi: { ...current.domains.webUi, checkpointId },
        },
      });
      const status = await getLanguageActivationAdminView({
        actorUserId: "admin-1",
        languageId: record.languageId,
      });
      assert.equal(status.job?.domains.webUi.preparationPhase, expected.phase);
      assert.equal(status.job?.domains.webUi.status, expected.web);
      if (expected.web === "in_progress") {
        assert.equal(status.job?.status, "running");
      }
      if (expected.phase === "failed") {
        assert.equal(status.job?.status, "failed");
        assert.equal(status.job?.domains.webUi.status, "failed");
      }
      if (expected.phase === "ready") {
        assert.equal(status.job?.domains.webUi.status, "ready");
      }
    }
  });

  it("13–14 boot resumes a claimed running job and ignores historical waiting_for_data", async () => {
    const claimed = await waitingJob("vo");
    await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: claimed.record.languageId,
      scheduleProcess: false,
    });
    const historical = await waitingJob("cy");
    assert.equal(historical.job.status, "waiting_for_data");
    resetLanguageActivationJobSchedulerForTests();
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(resumed.scheduled, 1);
    const historicalAfter = await getLanguageActivationJobById(historical.job.jobId);
    assert.equal(historicalAfter?.status, "waiting_for_data");
  });

  it("18 status refresh after in-progress tick does not regress to waiting_for_data", async () => {
    const { record, job } = await waitingJob("sw");
    await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      skipWebUiPreparation: false,
      webUiPreparationDeps: {
        includePaths: INCLUDE_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          return translate(request);
        },
      },
    });
    const ticked = await processLanguageActivationJob(job.jobId, { webUiTick: true });
    assert.equal(ticked.domains.webUi.status, "in_progress");
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(status.job?.status, "running");
    assert.equal(status.job?.domains.webUi.status, "in_progress");
    assert.equal(status.searchEnabled, false);
    assert.equal(status.job?.searchEnabledSnapshot, false);
  });
});
