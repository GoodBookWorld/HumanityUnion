/**
 * Step 15C.4 — WEB_UI follow-up tick is remembered while the single-flight lock is held.
 * Deterministic provider only. No Gemini.
 */
import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import {
  createLanguageRegistryRecord,
  ensureLanguageRegistrySeeded,
  resetLanguageRegistryStoreForTests,
  setLanguageRegistryForceMemoryForTests,
} from "../../../src/modules/language/index.js";
import { TranslationProviderError } from "../../../src/modules/language/translation.config.js";
import type { TranslationProviderRequest } from "../../../src/modules/language/translation-provider.js";
import {
  getLanguageActivationAdminView,
  processLanguageActivationJob,
  resetLanguageActivationJobSchedulerForTests,
  resetLanguageActivationJobStoreForTests,
  resumeIncompleteWebUiActivationJobsOnBoot,
  scheduleWebUiActivationTick,
  setLanguageActivationJobAdminAssertOverrideForTests,
  setLanguageActivationJobForceMemoryForTests,
  setLanguageActivationJobProcessDepsForTests,
  startOrResumeLanguageActivationJob,
} from "../../../src/modules/language/language-localization-activation/index.js";
import { getWebUiActivationSchedulerSnapshotForTests } from "../../../src/modules/language/language-localization-activation/language-activation-job.service.js";
import { getLanguageActivationJobById } from "../../../src/modules/language/language-localization-activation/language-activation-job.repository.js";
import { loadPublicWebUiEnglishCorpus } from "../../../src/modules/web-ui-message-packs/web-ui-draft-builder.js";
import {
  getWebUiActivationCheckpointByJobId,
  listWebUiActivationBatches,
  resetWebUiActivationCheckpointStoreForTests,
  setWebUiActivationCheckpointForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-activation-checkpoint.repository.js";
import {
  resetWebUiMessagePackStoreForTests,
  setWebUiMessagePackForceMemoryForTests,
} from "../../../src/modules/web-ui-message-packs/web-ui-message-pack.repository.js";

const FOUR_BATCH_PATHS = loadPublicWebUiEnglishCorpus().requiredPaths.slice(0, 24);
const TWO_BATCH_PATHS = FOUR_BATCH_PATHS.slice(0, 12);

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

function activateNoOp() {
  return async (input: { locale: string }) => {
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
  };
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe("Step 15C.4 — WEB_UI follow-up tick scheduling", () => {
  beforeEach(async () => {
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
      participantId: "participant-admin-15c4",
    }));
  });

  afterEach(() => {
    setLanguageActivationJobProcessDepsForTests(null);
    setLanguageActivationJobAdminAssertOverrideForTests(null);
    resetLanguageActivationJobSchedulerForTests();
  });

  async function createQueuedJob(locale: string) {
    const record = await createLanguageRegistryRecord({
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
    const started = await startOrResumeLanguageActivationJob({
      actorUserId: "admin-1",
      languageId: record.languageId,
      scheduleProcess: false,
    });
    assert.ok(started.job);
    return { record, job: started.job };
  }

  it("1–10 follow-up requested while in flight runs once and chains batches 1 through 4", async () => {
    const { record, job } = await createQueuedJob("eo");
    let active = 0;
    let peak = 0;
    let providerCalls = 0;
    let releaseGate: (() => void) | null = null;
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: FOUR_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          active += 1;
          peak = Math.max(peak, active);
          try {
            if (providerCalls === 1) {
              assert.equal(getWebUiActivationSchedulerSnapshotForTests(job.jobId).inFlight, true);
              scheduleWebUiActivationTick(job.jobId);
              scheduleWebUiActivationTick(job.jobId);
              scheduleWebUiActivationTick(job.jobId);
              const snap = getWebUiActivationSchedulerSnapshotForTests(job.jobId);
              assert.equal(snap.inFlight, true);
              assert.equal(snap.followUpRequested, true);
              assert.equal(providerCalls, 1);
              const during = await getLanguageActivationAdminView({
                actorUserId: "admin-1",
                languageId: record.languageId,
              });
              assert.equal(providerCalls, 1);
              assert.equal(during.job?.status, "running");
              assert.notEqual(during.job?.domains.webUi.status, "waiting_for_data");
              await gate;
            }
            return translate(request);
          } finally {
            active -= 1;
          }
        },
      },
    });

    scheduleWebUiActivationTick(job.jobId);
    assert.equal(getWebUiActivationSchedulerSnapshotForTests(job.jobId).inFlight, true);
    for (let i = 0; i < 20 && providerCalls < 1; i += 1) {
      await settle();
    }
    assert.equal(providerCalls, 1);
    assert.equal(peak, 1);
    releaseGate?.();

    for (let i = 0; i < 160; i += 1) {
      const current = await getWebUiActivationCheckpointByJobId(job.jobId);
      const snap = getWebUiActivationSchedulerSnapshotForTests(job.jobId);
      if (
        (current?.completedBatchCount ?? 0) >= 4 &&
        (current?.phase === "ready" || current?.phase === "failed") &&
        !snap.inFlight &&
        !snap.followUpRequested
      ) {
        break;
      }
      await settle();
    }
    assert.equal(peak, 1);
    assert.ok(providerCalls >= 4);
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    assert.equal(checkpoint.phase, "ready");
    assert.ok(checkpoint.completedBatchCount >= 4);
    const primary = await listWebUiActivationBatches(checkpoint.checkpointId, "primary");
    assert.ok(primary.filter((batch) => batch.status === "ok").length >= 4);
    const callsAtReady = providerCalls;
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, callsAtReady);
    assert.equal(status.job?.domains.webUi.status, "ready");
    const again = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(providerCalls, callsAtReady);
    assert.equal(again.job?.status, status.job?.status);
    assert.equal(again.job?.domains.webUi.status, "ready");
    assert.equal(getWebUiActivationSchedulerSnapshotForTests(job.jobId).followUpRequested, false);
  });

  it("11–16 restart skips completed batches; failure and ready do not chain; boot uses the scheduler", async () => {
    const { record, job } = await createQueuedJob("ia");
    let providerCalls = 0;
    const seenPrimaryKeys: string[] = [];
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS,
        loadLiveTerminology: async () => "LIVE",
        translator: async (request) => {
          providerCalls += 1;
          const parsed = JSON.parse(request.text) as Record<string, string>;
          seenPrimaryKeys.push(Object.keys(parsed).sort().join("|"));
          return {
            translatedText: request.text,
            providerId: "deterministic",
            isPlaceholder: false,
          };
        },
      },
    });

    mock.timers.enable({ apis: ["setImmediate"] });
    let timersMocked = true;
    try {
      const first = await processLanguageActivationJob(job.jobId, { webUiTick: true });
      assert.equal(first.status, "running");
      assert.equal(providerCalls, 1);
      const firstKeys = seenPrimaryKeys[0];
      resetLanguageActivationJobSchedulerForTests();
      mock.timers.reset();
      timersMocked = false;
    const resumed = await resumeIncompleteWebUiActivationJobsOnBoot();
    assert.equal(resumed.scheduled, 1);
    for (let i = 0; i < 40 && providerCalls < 2; i += 1) {
      await settle();
    }
    assert.ok(providerCalls >= 2);
    assert.equal(seenPrimaryKeys.filter((keys) => keys === firstKeys).length, 1);
    const checkpoint = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.ok(checkpoint);
    const firstBatch = (await listWebUiActivationBatches(checkpoint.checkpointId, "primary")).find(
      (batch) => batch.status === "ok",
    );
    assert.ok(firstBatch);
    assert.equal(firstBatch.attempts, 1);

    for (let i = 0; i < 80; i += 1) {
      const current = await getWebUiActivationCheckpointByJobId(job.jobId);
      if (current?.phase === "ready" || current?.phase === "failed") {
        break;
      }
      await settle();
    }
    const finished = await getWebUiActivationCheckpointByJobId(job.jobId);
    assert.equal(finished?.phase, "ready");
    assert.ok((finished?.qualityCompletedBatchCount ?? 0) >= 1);
    const callsAtReady = providerCalls;
    for (let i = 0; i < 8; i += 1) {
      await settle();
    }
    assert.equal(providerCalls, callsAtReady);
    assert.equal(getWebUiActivationSchedulerSnapshotForTests(job.jobId).followUpRequested, false);

    const failed = await createQueuedJob("vo");
    providerCalls = 0;
    setLanguageActivationJobProcessDepsForTests({
      skipCorpusInReadiness: true,
      skipOwnerPreparation: true,
      activate: activateNoOp(),
      webUiPreparationDeps: {
        includePaths: TWO_BATCH_PATHS.slice(0, 3),
        loadLiveTerminology: async () => "LIVE",
        translator: async () => {
          providerCalls += 1;
          throw new TranslationProviderError("not_configured", "provider unavailable");
        },
      },
    });
    scheduleWebUiActivationTick(failed.job.jobId);
    for (let i = 0; i < 30 && providerCalls < 1; i += 1) {
      await settle();
    }
    const failedJob = await getLanguageActivationJobById(failed.job.jobId);
    assert.equal(failedJob?.status, "failed");
    const callsAtFailure = providerCalls;
    for (let i = 0; i < 8; i += 1) {
      await settle();
    }
    assert.equal(providerCalls, callsAtFailure);
    assert.equal(
      getWebUiActivationSchedulerSnapshotForTests(failed.job.jobId).followUpRequested,
      false,
    );
    const status = await getLanguageActivationAdminView({
      actorUserId: "admin-1",
      languageId: record.languageId,
    });
    assert.equal(status.job?.jobId, job.jobId);
    } finally {
      if (timersMocked) {
        mock.timers.reset();
      }
    }
  });
});
